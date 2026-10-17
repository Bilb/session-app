#include "SessionMediaJni.hpp"

#include "MediaSource.hpp"

#include <session_bridge/decode_plan.hpp>
#include <session_bridge/media_url.hpp>

#include <oxen/log.hpp>
#include <pthread.h>

#include <algorithm>
#include <climits>
#include <cstddef>
#include <functional>
#include <memory>
#include <span>
#include <string>
#include <utility>
#include <vector>

namespace {

auto cat = oxen::log::Cat("media");

JavaVM* java_vm = nullptr;
jmethodID on_media = nullptr;
jmethodID on_thumbhash = nullptr;
jmethodID on_failure = nullptr;
jclass media_native = nullptr;
pthread_key_t detach_on_exit;

/// The calling thread's JNIEnv, attaching it if it is one of Core's: ART aborts the process when
/// an attached native thread exits undetached, hence the key whose destructor detaches it. Null
/// when the VM refuses the attach, which leaves no way to answer Java at all.
JNIEnv* attached_env() {
    JNIEnv* env = nullptr;
    if (java_vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK)
        return env;
    if (java_vm->AttachCurrentThread(&env, nullptr) != JNI_OK)
        return nullptr;
    pthread_setspecific(detach_on_exit, env);
    return env;
}

/// Left pending on one of Core's threads, an exception would break that thread's next JNI call.
bool clear_pending(JNIEnv* env) {
    if (!env->ExceptionCheck())
        return false;
    env->ExceptionClear();
    return true;
}

/// The pending exception's `toString()`, clearing it; empty when none was pending.
std::string take_pending(JNIEnv* env) {
    jthrowable thrown = env->ExceptionOccurred();
    if (!thrown)
        return {};
    env->ExceptionClear();
    std::string text = "an exception";
    jclass type = env->GetObjectClass(thrown);
    jmethodID to_string = env->GetMethodID(type, "toString", "()Ljava/lang/String;");
    auto described = to_string ? static_cast<jstring>(env->CallObjectMethod(thrown, to_string))
                               : nullptr;
    if (described) {
        if (const char* chars = env->GetStringUTFChars(described, nullptr)) {
            text = chars;
            env->ReleaseStringUTFChars(described, chars);
        }
        env->DeleteLocalRef(described);
    }
    clear_pending(env);
    env->DeleteLocalRef(type);
    env->DeleteLocalRef(thrown);
    return text;
}

void fail(JNIEnv* env, jobject load, const std::string& message) {
    jstring text = env->NewStringUTF(message.c_str());
    if (!text) {
        clear_pending(env);
        return;
    }
    env->CallVoidMethod(load, on_failure, text);
    clear_pending(env);
    env->DeleteLocalRef(text);
}

/// Hands `bytes` to Java as a direct buffer over this memory, which Java frees through `release`
/// once it has copied it into Fresco's pool. Null, with the memory already freed, when the bytes
/// are past a jint - ART aborts the process rather than refuse that - or the VM is out of memory.
jobject lend(JNIEnv* env, std::vector<std::byte>&& bytes, jlong& handle) {
    handle = 0;
    if (bytes.size() > static_cast<size_t>(INT_MAX))
        return nullptr;
    auto* held = new std::vector<std::byte>(std::move(bytes));
    jobject buffer = env->NewDirectByteBuffer(held->data(), static_cast<jlong>(held->size()));
    if (!buffer) {
        clear_pending(env);
        delete held;
        return nullptr;
    }
    handle = reinterpret_cast<jlong>(held);
    return buffer;
}

constexpr const char* UNLENDABLE = "the bytes do not fit a ByteBuffer";
constexpr const char* REFUSED = "the loader's thread did not take the answer";

/// Hands an encoded picture to Fresco's decoder, which reads the format from the bytes.
void hand_over(JNIEnv* env, jobject load, std::vector<std::byte>&& bytes) {
    jlong handle = 0;
    jobject buffer = lend(env, std::move(bytes), handle);
    if (!buffer) {
        fail(env, load, UNLENDABLE);
        return;
    }
    env->CallVoidMethod(load, on_media, buffer, handle);
    // A throw means the loader's thread never took the job, so nothing else releases it.
    if (clear_pending(env)) {
        delete reinterpret_cast<std::vector<std::byte>*>(handle);
        fail(env, load, REFUSED);
    }
    env->DeleteLocalRef(buffer);
}

/// Answers on whichever thread the source answered on - Core's loop, or the JS thread - and only
/// hands on: every method it calls enqueues onto the loader's own thread and returns.
void answer_media(jobject load, ::session_bridge::Media media) {
    JNIEnv* env = attached_env();
    if (!env)
        return;
    if (media.error)
        fail(env, load, *media.error);
    else if (::session_bridge::servable_image_type(media.content_type, media.bytes))
        hand_over(env, load, std::move(media.bytes));
    else
        fail(env, load, "not a picture the decoder may be handed");
    env->DeleteGlobalRef(load);
}

/// Only ever a JPEG: libsession makes nothing else, and caps its side at 1024.
void answer_thumbnail(jobject load, ::session_bridge::Media media) {
    JNIEnv* env = attached_env();
    if (!env)
        return;
    if (media.error)
        fail(env, load, *media.error);
    else if (::session_bridge::servable_image_type("image/jpeg", media.bytes) == "image/jpeg")
        hand_over(env, load, std::move(media.bytes));
    else
        fail(env, load, "a thumbnail that is not a JPEG");
    env->DeleteGlobalRef(load);
}

/// Typed by its bytes rather than by whoever answered: a JPEG or a WebP, animated or not.
void answer_rendition(jobject load, ::session_bridge::Media media) {
    JNIEnv* env = attached_env();
    if (!env)
        return;
    if (media.error)
        fail(env, load, *media.error);
    else if (::session_bridge::rendition_content_type(media.bytes))
        hand_over(env, load, std::move(media.bytes));
    else
        fail(env, load, "a rendition that is not a JPEG or WebP");
    env->DeleteGlobalRef(load);
}

/// Larger than any ThumbHash decodes to, and small enough that `width * height * 4` fits a jint.
constexpr double MAX_THUMBHASH_SIDE = 16384;

void answer_thumbhash(jobject load, ::session_bridge::Thumbhash thumbhash) {
    JNIEnv* env = attached_env();
    if (!env)
        return;
    // Checked as doubles: casting NaN or 1e12 to jint is undefined, so no cast may come first.
    const bool sized = thumbhash.width > 0 && thumbhash.width <= MAX_THUMBHASH_SIDE
                    && thumbhash.height > 0 && thumbhash.height <= MAX_THUMBHASH_SIDE;
    if (thumbhash.error) {
        fail(env, load, *thumbhash.error);
    } else if (!sized) {
        fail(env, load, "a thumbhash whose size is not a picture's");
    } else {
        const auto width = static_cast<jint>(thumbhash.width);
        const auto height = static_cast<jint>(thumbhash.height);
        if (thumbhash.rgba.size() != static_cast<size_t>(width) * static_cast<size_t>(height) * 4) {
            fail(env, load, "a thumbhash whose pixels do not match its size");
        } else {
            jlong handle = 0;
            jobject buffer = lend(env, std::move(thumbhash.rgba), handle);
            if (!buffer) {
                fail(env, load, UNLENDABLE);
            } else {
                env->CallVoidMethod(load, on_thumbhash, width, height, buffer, handle);
                if (clear_pending(env)) {
                    delete reinterpret_cast<std::vector<std::byte>*>(handle);
                    fail(env, load, REFUSED);
                }
                env->DeleteLocalRef(buffer);
            }
        }
    }
    env->DeleteGlobalRef(load);
}

void forget_pictures() {
    JNIEnv* env = attached_env();
    if (!env)
        return;
    // Looked up here rather than at load: that initialises the class, whose initialiser loads
    // this very library.
    static jmethodID forget = env->GetStaticMethodID(media_native, "forgetPictures", "()V");
    if (!forget) {
        clear_pending(env);
        oxen::log::error(cat, "No forgetPictures: a discard leaves pictures cached");
        return;
    }
    env->CallStaticVoidMethod(media_native, forget);
    if (auto thrown = take_pending(env); !thrown.empty())
        oxen::log::warning(cat, "forgetPictures threw, so pictures may stay cached: {}", thrown);
}

}  // namespace

namespace session_bridge_rn {

jint register_media_loader(JavaVM* vm) {
    java_vm = vm;
    JNIEnv* env = nullptr;
    if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK)
        return JNI_ERR;
    // Looked up here, on a thread with the app's class loader: Core's loop has only the system one.
    jclass load = env->FindClass("session/bridge/rn/SessionMediaLoad");
    if (!load)
        return JNI_ERR;
    on_media = env->GetMethodID(load, "onMedia", "(Ljava/nio/ByteBuffer;J)V");
    on_thumbhash = env->GetMethodID(load, "onThumbhash", "(IILjava/nio/ByteBuffer;J)V");
    on_failure = env->GetMethodID(load, "onFailure", "(Ljava/lang/String;)V");
    env->DeleteLocalRef(load);
    if (!on_media || !on_thumbhash || !on_failure)
        return JNI_ERR;
    jclass native = env->FindClass("session/bridge/rn/SessionMediaNative");
    if (!native)
        return JNI_ERR;
    media_native = static_cast<jclass>(env->NewGlobalRef(native));
    env->DeleteLocalRef(native);
    set_media_forgetter(forget_pictures);
    pthread_key_create(&detach_on_exit, [](void*) { java_vm->DetachCurrentThread(); });
    return JNI_VERSION_1_6;
}

}  // namespace session_bridge_rn

extern "C" JNIEXPORT jlong JNICALL
Java_session_bridge_rn_SessionMediaNative_fetch(JNIEnv* env, jclass, jstring url, jobject load) {
    const char* chars = env->GetStringUTFChars(url, nullptr);
    if (!chars)
        return 0;  // OutOfMemoryError is pending and is thrown from fetch().
    const std::string text{chars};
    env->ReleaseStringUTFChars(url, chars);

    const auto parsed = ::session_bridge::parse_media_url(text);
    if (!parsed) {
        fail(env, load, "not a media URL");
        return 0;
    }
    auto source = ::session_bridge_rn::media_source();
    if (!source) {
        fail(env, load, "nothing is serving media");
        return 0;
    }

    jobject held = env->NewGlobalRef(load);
    if (parsed->kind == ::session_bridge::MediaUrlKind::thumbhash)
        source->fetch_thumbhash(parsed->message_id, parsed->index, [held](auto thumbhash) {
            answer_thumbhash(held, std::move(thumbhash));
        });
    else if (parsed->kind == ::session_bridge::MediaUrlKind::thumbnail)
        source->fetch_thumbnail(parsed->message_id, parsed->index, [held](auto media) {
            answer_thumbnail(held, std::move(media));
        });
    else if (parsed->kind == ::session_bridge::MediaUrlKind::rendition)
        source->fetch_rendition(parsed->message_id, parsed->index, [held](auto media) {
            answer_rendition(held, std::move(media));
        });
    else if (parsed->kind == ::session_bridge::MediaUrlKind::staged)
        return reinterpret_cast<jlong>(new std::function<void()>{source->fetch_staged_thumbnail(
                parsed->path, [held](auto media) { answer_thumbnail(held, std::move(media)); })});
    else
        source->fetch_media(parsed->message_id, parsed->index, [held](auto media) {
            answer_media(held, std::move(media));
        });
    return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_session_bridge_rn_SessionMediaNative_withdraw(JNIEnv*, jclass, jlong handle) {
    std::unique_ptr<std::function<void()>> withdraw{reinterpret_cast<std::function<void()>*>(handle)};
    (*withdraw)();
}

extern "C" JNIEXPORT void JNICALL
Java_session_bridge_rn_SessionMediaNative_forget(JNIEnv*, jclass, jlong handle) {
    delete reinterpret_cast<std::function<void()>*>(handle);
}

extern "C" JNIEXPORT void JNICALL
Java_session_bridge_rn_SessionMediaNative_release(JNIEnv*, jclass, jlong handle) {
    delete reinterpret_cast<std::vector<std::byte>*>(handle);
}

/// The shim's plan for the first `size` bytes of a direct buffer, as `[edge, first frame only,
/// refused]`; null with OutOfMemoryError pending.
extern "C" JNIEXPORT jintArray JNICALL
Java_session_bridge_rn_SessionMediaNative_plan(JNIEnv* env, jclass, jobject bytes, jint size) {
    const auto* data = static_cast<const std::byte*>(env->GetDirectBufferAddress(bytes));
    const jlong capacity = env->GetDirectBufferCapacity(bytes);
    const auto plan = data && size >= 0 && size <= capacity
                            ? ::session_bridge::decode_plan(std::span{data, static_cast<size_t>(size)})
                            : ::session_bridge::unmeasured_decode_plan();
    const jint values[] = {
            static_cast<jint>(std::min(plan.edge, static_cast<double>(INT_MAX))),
            plan.first_frame_only,
            plan.refused};
    jintArray out = env->NewIntArray(3);
    if (out)
        env->SetIntArrayRegion(out, 0, 3, values);
    return out;
}
