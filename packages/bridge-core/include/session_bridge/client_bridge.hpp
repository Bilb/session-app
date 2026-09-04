#pragma once

#include <array>
#include <cstddef>
#include <filesystem>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <string>

namespace session::bridge {

/// Everything the bridge needs to open a Client, and nothing it can work out for itself.
///
/// The database key is the application's to custody: libsession accepts one but neither derives
/// nor stores it, which is the entire reason the apps have a secure-storage port. Supply exactly
/// one of `raw_key` (what a new install generates and keeps in the OS keyring) or `password`
/// (the fallback where there is no keyring to keep it in); with neither, the database is opened
/// unencrypted, which is for tests.
struct InitOptions {
    std::filesystem::path db_path;

    /// Where attachment bytes are cached. Must be writable and is the application's to clear.
    std::filesystem::path cache_dir;

    std::optional<std::array<std::byte, 32>> raw_key;
    std::optional<std::string> password;

    /// Opens the database without creating an account, so that `getAccountInfo` can answer "no"
    /// and the app can show onboarding. **Without this a Client creates one on first open**, and
    /// an app that meant to ask the user has already decided for them. Between construction and
    /// `createAccount` or `restoreAccount` there is no identity, so anything needing one — the
    /// session id, sending, attaching a network — fails until that call.
    bool defer_account = false;
};

/// Receives one encoded `sessionbridge.v1.Frame` per call, in the order libsession produced them.
///
/// **Called on Core's event loop, and must only enqueue.** Everything downstream of the queue —
/// decoding, the hop to the JavaScript thread, delivery — belongs to the platform adapter. A sink
/// that blocks stalls polling, message receipt and every other call in flight; a sink that throws
/// loses the frame.
using Sink = std::function<void(std::span<const std::byte>)>;

/// One libsession Client behind one ordered frame stream.
///
/// Deliberately sets **no libsession dispatcher**. `callbacks.hpp` prescribes handlers that copy
/// their argument into the application's own queue and return, which is exactly what encoding into
/// a frame and enqueueing it is — so the handlers run inline on Core's loop and the platform
/// adapter owns the hop onto the JavaScript thread. Installing a dispatcher as well would add a
/// second queue in front of ours, buying nothing and costing the ordering guarantee that having
/// one queue is what provides.
///
/// Command responses go to the same sink as events, correlated by request id, because their
/// relative order is load-bearing: see frames.proto.
class ClientBridge {
  public:
    /// Opens the database and publishes the initial state. Throws if the database cannot be
    /// opened — a wrong key, a directory that is not writable — since there is no bridge to
    /// report that failure over yet.
    ClientBridge(InitOptions options, Sink sink);
    ~ClientBridge();

    ClientBridge(const ClientBridge&) = delete;
    ClientBridge& operator=(const ClientBridge&) = delete;

    /// Decodes one `sessionbridge.v1.Request` and dispatches it. Returns as soon as the work is
    /// handed to Core; the answer arrives on the sink as a `Response` carrying the same id.
    ///
    /// Never throws: a request that cannot be decoded, names something that does not exist, or
    /// fails validation comes back as a Response with `error` set. Throwing here would surface on
    /// whichever thread the adapter happens to call from, where nothing knows which request it
    /// belonged to.
    void call(std::span<const std::byte> request);

    /// Stops delivering frames and destroys the Client, which joins Core's loop. Idempotent, and
    /// implied by the destructor. Handlers for calls still in flight are dropped rather than
    /// completed — the facade rejects their promises, which is where "exactly once" is restored.
    void close();

  private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

}  // namespace session::bridge
