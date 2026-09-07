#include "HybridSessionBridge.hpp"

#include <session_bridge/client_bridge.hpp>

#include <array>
#include <cstddef>
#include <stdexcept>
#include <string>

namespace margelo::nitro::session::bridge::rn {

namespace {

    // InitOptions carries these as strings, because that is what the wire format and the addon
    // both hand it. JSI gets a closed enum instead, so an unknown value cannot reach the shim at
    // all, and this is the one place the two representations meet.
    std::string netid_name(NetId id) {
        switch (id) {
            case NetId::MAINNET: return "mainnet";
            case NetId::TESTNET: return "testnet";
        }
        return "";
    }

    std::string device_type_name(DeviceType type) {
        switch (type) {
            case DeviceType::IOS: return "ios";
            case DeviceType::ANDROID_: return "android";
            case DeviceType::DESKTOP: return "desktop";
        }
        return "";
    }

    std::string log_level_name(LibsessionLogLevel level) {
        switch (level) {
            case LibsessionLogLevel::TRACE: return "trace";
            case LibsessionLogLevel::DEBUG_: return "debug";
            case LibsessionLogLevel::INFO: return "info";
            case LibsessionLogLevel::WARN: return "warn";
            case LibsessionLogLevel::ERROR: return "error";
            case LibsessionLogLevel::CRITICAL: return "critical";
        }
        return "";
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

void HybridSessionBridge::setSink(
        const std::function<void(const std::shared_ptr<ArrayBuffer>&)>& onFrame) {
    _sink = onFrame;
}

void HybridSessionBridge::init(const SessionBridgeOptions& options) {
    if (_bridge)
        throw std::runtime_error{"the bridge is already open"};

    ::session::bridge::InitOptions init;
    init.db_path = options.dbPath;
    init.cache_dir = options.cacheDir;
    init.defer_account = options.deferAccount;
    if (options.netid)
        init.netid = netid_name(*options.netid);
    if (options.deviceType)
        init.device_type = device_type_name(*options.deviceType);
    if (options.logLevel)
        init.log_level = log_level_name(*options.logLevel);
    if (options.rawKeyHex)
        init.raw_key = key_from_hex(*options.rawKeyHex);
    else if (options.password)
        init.password = *options.password;

    _bridge = std::make_unique<::session::bridge::ClientBridge>(
            std::move(init), [this](std::span<const std::byte> frame) {
                if (!_sink)
                    return;
                // Copied rather than wrapped: this runs on Core's loop, the callback is
                // delivered on the JavaScript thread some time later, and the frame is gone by
                // then. Nitro's void callbacks carry the hop and the ordering with them, which
                // is the same guarantee the addon gets from a thread-safe function.
                _sink(ArrayBuffer::copy(
                        reinterpret_cast<const uint8_t*>(frame.data()), frame.size()));
            });
}

void HybridSessionBridge::call(const std::shared_ptr<ArrayBuffer>& request) {
    if (!_bridge)
        throw std::runtime_error{"call() before init()"};
    _bridge->call(std::span{
            reinterpret_cast<const std::byte*>(request->data()), request->size()});
}

void HybridSessionBridge::close() {
    // Destroy before dropping the sink: destroying joins Core's loop, so nothing can be
    // produced afterwards, and a frame in flight still has somewhere to go.
    _bridge.reset();
    _sink = nullptr;
}

}  // namespace margelo::nitro::session::bridge::rn
