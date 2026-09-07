#include <napi.h>
#include <session_bridge/client_bridge.hpp>

#include <cstring>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace {

/// One `ClientBridge`, with a thread-safe function standing between Core's loop and V8.
///
/// The addon is the whole of the "platform adapter owns the hop onto the JS thread" half of the
/// shim's contract. Everything below it runs on Core's loop and only enqueues; everything above it
/// is JavaScript.
class SessionBridge : public Napi::ObjectWrap<SessionBridge> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function ctor = DefineClass(
                env,
                "SessionBridge",
                {
                        InstanceMethod<&SessionBridge::Call>("call"),
                        InstanceMethod<&SessionBridge::Close>("close"),
                });
        exports.Set("SessionBridge", ctor);
        return exports;
    }

    explicit SessionBridge(const Napi::CallbackInfo& info) : Napi::ObjectWrap<SessionBridge>{info} {
        Napi::Env env = info.Env();

        if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsFunction())
            throw Napi::TypeError::New(env, "new SessionBridge(options, onFrame)");

        Napi::Object options = info[0].As<Napi::Object>();
        session::bridge::InitOptions init;

        init.db_path = options.Get("dbPath").As<Napi::String>().Utf8Value();
        if (options.Has("cacheDir"))
            init.cache_dir = options.Get("cacheDir").As<Napi::String>().Utf8Value();

        if (options.Has("rawKey") && !options.Get("rawKey").IsUndefined()) {
            Napi::Value raw = options.Get("rawKey");
            if (!raw.IsTypedArray())
                throw Napi::TypeError::New(env, "rawKey must be a Uint8Array of 32 bytes");
            auto bytes = raw.As<Napi::Uint8Array>();
            if (bytes.ElementLength() != 32)
                throw Napi::TypeError::New(env, "rawKey must be exactly 32 bytes");
            std::array<std::byte, 32> key{};
            std::memcpy(key.data(), bytes.Data(), key.size());
            init.raw_key = key;
        } else if (options.Has("password") && !options.Get("password").IsUndefined()) {
            init.password = options.Get("password").As<Napi::String>().Utf8Value();
        }

        if (options.Has("deferAccount"))
            init.defer_account = options.Get("deferAccount").ToBoolean().Value();
        if (options.Has("netid") && !options.Get("netid").IsUndefined())
            init.netid = options.Get("netid").As<Napi::String>().Utf8Value();
        if (options.Has("deviceType") && !options.Get("deviceType").IsUndefined())
            init.device_type = options.Get("deviceType").As<Napi::String>().Utf8Value();
        if (options.Has("logLevel") && !options.Get("logLevel").IsUndefined())
            init.log_level = options.Get("logLevel").As<Napi::String>().Utf8Value();

        // Unlimited queue, so a frame produced on Core's loop is never dropped and BlockingCall
        // never blocks the thread that produced it. The frames are small and the JavaScript side
        // drains them on its next tick; bounding this would trade a bounded queue for lost
        // ordering, which is the one thing this stream exists to keep.
        _sink = Napi::ThreadSafeFunction::New(
                env, info[1].As<Napi::Function>(), "sessionBridgeSink", 0, 1);

        try {
            _bridge = std::make_unique<session::bridge::ClientBridge>(
                    std::move(init), [this](std::span<const std::byte> frame) {
                        auto* copy = new std::vector<uint8_t>(
                                reinterpret_cast<const uint8_t*>(frame.data()),
                                reinterpret_cast<const uint8_t*>(frame.data()) + frame.size());

                        auto status = _sink.BlockingCall(
                                copy,
                                [](Napi::Env cb_env,
                                   Napi::Function cb,
                                   std::vector<uint8_t>* bytes) {
                                    cb.Call({Napi::Buffer<uint8_t>::Copy(
                                            cb_env, bytes->data(), bytes->size())});
                                    delete bytes;
                                });

                        // The only way this fails is a sink already released, which means close()
                        // won the race. Dropping the frame is then correct; leaking it is not.
                        if (status != napi_ok)
                            delete copy;
                    });
        } catch (const std::exception& e) {
            _sink.Release();
            throw Napi::Error::New(env, e.what());
        }
    }

    ~SessionBridge() override { Shutdown(); }

  private:
    void Call(const Napi::CallbackInfo& info) {
        if (!_bridge)
            return;
        if (info.Length() < 1 || !info[0].IsTypedArray())
            throw Napi::TypeError::New(info.Env(), "call(request) takes a Uint8Array");

        auto request = info[0].As<Napi::Uint8Array>();
        _bridge->call(std::span{
                reinterpret_cast<const std::byte*>(request.Data()), request.ElementLength()});
    }

    void Close(const Napi::CallbackInfo&) { Shutdown(); }

    void Shutdown() {
        if (!_bridge)
            return;
        // Destroying the bridge first joins Core's loop, so no frame can be produced after the
        // sink is released and the release cannot race a call into a dead function.
        _bridge.reset();
        _sink.Release();
    }

    std::unique_ptr<session::bridge::ClientBridge> _bridge;
    Napi::ThreadSafeFunction _sink;
};

}  // namespace

static Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return SessionBridge::Init(env, exports);
}

NODE_API_MODULE(session_bridge_node, InitAll)
