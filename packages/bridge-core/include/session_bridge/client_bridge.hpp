#pragma once

#include <array>
#include <cstddef>
#include <filesystem>
#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "session_bridge/gen/types.hpp"

namespace session_bridge {

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

    /// Passes libsession's `session::core::defer_account` to the Client constructor; the bridge
    /// adds nothing of its own here.
    ///
    /// Opens the database without creating an account, so that `getAccountInfo` can answer "no"
    /// and the app can show onboarding. **Without this a Client creates one on first open**, and
    /// an app that meant to ask the user has already decided for them. Between construction and
    /// `createAccount` or `restoreAccount` there is no identity, so anything needing one - the
    /// session id, sending, attaching a network - fails until that call.
    bool defer_account = false;

    /// Which network to reach, or empty to never reach one.
    ///
    /// "mainnet" or "testnet". Empty is the whole of the offline guarantee: attaching
    /// is the only thing that gives Core a way off the machine, so declining to do it is more
    /// dependable than a flag each send has to remember to consult. The contract suite runs this
    /// way, and so does anything that must not touch a real swarm.
    ///
    /// Attached at construction when an account already exists, and again after `createAccount`
    /// or `restoreAccount`, because attaching to an identity-less Core throws and there would be
    /// nothing to poll for anyway.
    std::string netid;

    /// What this client tells the account's other devices it is: "ios", "android" or "desktop".
    ///
    /// libsession establishes the device group with these fields blank and says outright that
    /// filling them in is the application's job; until it happens, every other device lists this
    /// one as an unrecognised device with no version. There is no device type for this client
    /// yet - see docs/STATUS.md - so it reports the platform it is running on, which is true.
    std::string device_type;

    /// How much of libsession's own logging to forward, as `log` events.
    ///
    /// "trace", "debug", "info", "warn", "error", "critical", or empty for none. Worth having
    /// because the state machine reports *what* happened and not *why*: a send that ends in
    /// `failed` carries no reason, and the reason is in these lines.
    ///
    /// Registered process-wide - libsession's add_logger has no deregistration - so a second
    /// bridge in one process would double them up. There is one. A line logged after its bridge
    /// closed is dropped: the logger holds the bridge weakly.
    std::string log_level;
};

/// Receives one `Frame` per call, in the order libsession produced them.
///
/// **Called on Core's event loop, and must only enqueue.** Moving the frame into a queue is the
/// whole of what belongs here; the hop to the JavaScript thread and turning the struct into a
/// JavaScript object belong to the platform adapter. A sink that blocks stalls polling, message
/// receipt and every other call in flight; a sink that throws loses the frame.
using Sink = std::function<void(Frame)>;

/// One libsession Client behind one ordered frame stream.
///
/// Deliberately sets **no libsession dispatcher**. `callbacks.hpp` prescribes handlers that move
/// their argument into the application's own queue and return, which is exactly what filling a
/// frame and enqueueing it is - so the handlers run inline on Core's loop and the platform
/// adapter owns the hop onto the JavaScript thread. Installing a dispatcher as well would add a
/// second queue in front of ours, buying nothing and costing the ordering guarantee that having
/// one queue is what provides.
///
/// Command responses go to the same sink as events, correlated by request id, because their
/// relative order is load-bearing: see `Frame` in @session/bridge-types.
class ClientBridge {
  public:
    /// Opens the database and publishes the initial state. Throws if the database cannot be
    /// opened - a wrong key, a directory that is not writable - since there is no bridge to
    /// report that failure over yet.
    ClientBridge(InitOptions options, Sink sink);
    ~ClientBridge();

    ClientBridge(const ClientBridge&) = delete;
    ClientBridge& operator=(const ClientBridge&) = delete;

    /// Dispatches one request. Returns as soon as the work is handed to Core; the answer arrives
    /// on the sink as a `Response` carrying the same id.
    ///
    /// Never throws: a request that names something that does not exist or fails validation
    /// comes back as a Response with `error` set. Throwing here would surface on whichever thread
    /// the adapter happens to call from, where nothing knows which request it belonged to.
    void call(Request request);

    /// Stops delivering frames and destroys the Client, which joins Core's loop. Idempotent, and
    /// implied by the destructor. Handlers for calls still in flight are dropped rather than
    /// completed - the facade rejects their promises, which is where "exactly once" is restored.
    void close();

  private:
    struct Impl;
    /// Shared rather than unique because the process-wide logger holds a `weak_ptr` to it and
    /// can fire from a thread `close()` has no way to join.
    std::shared_ptr<Impl> _impl;
};

}  // namespace session_bridge
