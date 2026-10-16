#include "HybridSessionBridge.hpp"

#include <NitroModules/JSICache.hpp>
#include <session_bridge/client_bridge.hpp>
#include <session_bridge/gen/jsi.hpp>

#include <array>
#include <stdexcept>
#include <string>
#include <utility>

namespace margelo::nitro::session::bridge::rn {

namespace {

    // InitOptions carries these as strings, because that is what the wire format and the addon
    // both hand it. JSI gets a closed enum instead, so an unknown value cannot reach the shim at
    // all, and this is the one place the two representations meet.
    //
    // The fallback below is unreachable - the enum is closed and every member is handled - and is
    // there for the compiler. It says `<INVALID>` rather than nothing because the two are not
    // equally harmless if it ever is reached: an empty string is a plausible option value and
    // would travel on looking like a deliberate one, while this cannot be mistaken for anything
    // and is greppable in a log.
    std::string netid_name(NetId id) {
        switch (id) {
            case NetId::NET_MAINNET: return "mainnet";
            case NetId::NET_TESTNET: return "testnet";
            case NetId::NET_DEVNET: return "devnet";
        }
        return "<INVALID>";
    }

    ::session_bridge::RouterKind router_of(RouterKind kind) {
        switch (kind) {
            case RouterKind::ROUTER_KIND_ONION_REQUESTS:
                return ::session_bridge::RouterKind::onion_requests;
            case RouterKind::ROUTER_KIND_SESSION_ROUTER:
                return ::session_bridge::RouterKind::session_router;
            case RouterKind::ROUTER_KIND_DIRECT: return ::session_bridge::RouterKind::direct;
        }
        return ::session_bridge::RouterKind::session_router;
    }

    ::session_bridge::UrlScheme scheme_of(UrlScheme scheme) {
        switch (scheme) {
            case UrlScheme::URL_SCHEME_HTTP: return ::session_bridge::UrlScheme::http;
            case UrlScheme::URL_SCHEME_HTTPS: return ::session_bridge::UrlScheme::https;
        }
        return ::session_bridge::UrlScheme::http;
    }

    std::string device_type_name(DeviceType type) {
        switch (type) {
            case DeviceType::DEVICE_IOS: return "ios";
            case DeviceType::DEVICE_ANDROID: return "android";
            case DeviceType::DEVICE_DESKTOP: return "desktop";
        }
        return "<INVALID>";
    }

    std::string log_level_name(LibsessionLogLevel level) {
        switch (level) {
            case LibsessionLogLevel::LEVEL_TRACE: return "trace";
            case LibsessionLogLevel::LEVEL_DEBUG: return "debug";
            case LibsessionLogLevel::LEVEL_INFO: return "info";
            case LibsessionLogLevel::LEVEL_WARN: return "warn";
            case LibsessionLogLevel::LEVEL_ERROR: return "error";
            case LibsessionLogLevel::LEVEL_CRITICAL: return "critical";
        }
        return "<INVALID>";
    }

    std::array<std::byte, 32> key_from_hex(const std::string& hex) {
        if (hex.size() != 64)
            throw std::invalid_argument{"rawKeyHex must be 64 hex characters"};
        std::array<std::byte, 32> key{};
        for (size_t i = 0; i < key.size(); i++) {
            auto digit = [&](char c) -> unsigned {
                if (c >= '0' && c <= '9')
                    return static_cast<unsigned>(c - '0');
                if (c >= 'a' && c <= 'f')
                    return static_cast<unsigned>(c - 'a' + 10);
                if (c >= 'A' && c <= 'F')
                    return static_cast<unsigned>(c - 'A' + 10);
                throw std::invalid_argument{"rawKeyHex is not hex"};
            };
            key[i] = static_cast<std::byte>(digit(hex[i * 2]) << 4 | digit(hex[i * 2 + 1]));
        }
        return key;
    }

}  // namespace

// HybridObject is a virtual base, so the most-derived class is what constructs it - a defaulted
// constructor here compiles and then fails at the first createHybridObject with a message about
// forgetting this exact line.
HybridSessionBridge::HybridSessionBridge() : HybridObject(TAG) {}

HybridSessionBridge::~HybridSessionBridge() {
    close();
}

void HybridSessionBridge::loadHybridMethods() {
    HybridSessionBridgeSpec::loadHybridMethods();
    registerHybrids(this, [](Prototype& prototype) {
        prototype.registerRawHybridMethod("setSink", 1, &HybridSessionBridge::setSink);
    });
}

jsi::Value HybridSessionBridge::setSink(
        jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count) {
    if (count < 1 || !args[0].isObject() || !args[0].getObject(runtime).isFunction(runtime))
        throw jsi::JSError(runtime, "setSink(onFrame) takes a function");

    auto sink = std::make_shared<Sink>();
    sink->runtime = &runtime;
    {
        // Owned by the runtime's cache, so the reference goes null rather than dangling if the
        // runtime is torn down first; the scope keeps the cache lock short, as Nitro does.
        JSICacheReference cache = JSICache::getOrCreateCache(runtime);
        sink->function = cache.makeShared(args[0].getObject(runtime).getFunction(runtime));
    }
    sink->dispatcher = Dispatcher::getRuntimeGlobalDispatcher(runtime);
    _sink = std::move(sink);
    return jsi::Value::undefined();
}

void HybridSessionBridge::init(const SessionBridgeOptions& options) {
    if (_bridge)
        throw std::runtime_error{"the bridge is already open"};
    // libsession publishes the state it already has while the Client is constructed, so a sink
    // installed afterwards has missed the first frames. Refused rather than allowed to lose them.
    if (!_sink)
        throw std::runtime_error{"setSink() before init()"};

    ::session_bridge::InitOptions init;
    init.db_path = options.dbPath;
    init.cache_dir = options.cacheDir;
    init.defer_account = options.deferAccount;
    if (options.netid)
        init.network.netid = netid_name(*options.netid);
    if (options.seedNodes)
        for (const auto& seed : *options.seedNodes)
            init.network.seed_nodes.push_back(
                    {seed.ed25519PubkeyHex, seed.ip, seed.httpsPort, seed.omqPort});
    if (options.fileServer)
        init.network.file_server = ::session_bridge::FileServerConfig{
                scheme_of(options.fileServer->scheme),
                options.fileServer->host,
                options.fileServer->port,
                options.fileServer->x25519PubkeyHex};
    if (options.router)
        init.network.router = router_of(*options.router);
    if (options.deviceType)
        init.device_type = device_type_name(*options.deviceType);
    if (options.logLevel)
        init.log_level = log_level_name(*options.logLevel);
    if (options.logCategories)
        for (const auto& each : *options.logCategories)
            init.log_categories.push_back({each.category, log_level_name(each.level)});
    if (options.rawKeyHex)
        init.raw_key = key_from_hex(*options.rawKeyHex);
    else if (options.password)
        init.password = *options.password;

    _bridge = std::make_unique<::session_bridge::ClientBridge>(
            std::move(init), [sink = _sink](::session_bridge::Frame frame) {
                // This runs on Core's loop. The frame is moved into the job and becomes a
                // JavaScript object on the JS thread, through the JSIConverter generated beside
                // it; the dispatcher's queue is FIFO, which is the same ordering guarantee the
                // addon gets from a thread-safe function. Nothing between here and the converter
                // copies it - the reason setSink is a raw method.
                auto dispatcher = sink->dispatcher.lock();
                if (!dispatcher)
                    return;
                dispatcher->runAsync([sink, frame = std::move(frame)]() mutable {
                    if (!sink->function)
                        return;
                    auto& runtime = *sink->runtime;
                    sink->function->call(
                            runtime,
                            JSIConverter<::session_bridge::Frame>::toJSI(runtime, frame));
                });
            });
}

void HybridSessionBridge::call(::session_bridge::Request request) {
    if (!_bridge)
        throw std::runtime_error{"call() before init()"};
    _bridge->call(std::move(request));
}

void HybridSessionBridge::close() {
    // Destroy before dropping the sink: destroying joins Core's loop, so nothing can be
    // produced afterwards, and a frame in flight still has somewhere to go.
    _bridge.reset();
    _sink.reset();
}

}  // namespace margelo::nitro::session::bridge::rn
