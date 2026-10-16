#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "session_bridge/client_bridge.hpp"

namespace session_bridge {

/// A staged file's bytes, or nullopt when it cannot be read, is not a regular file, or is larger
/// than `max_bytes`. `path` is UTF-8.
///
/// Opened once and checked on that handle, never by name first: a FIFO or a device put in the
/// file's place would otherwise block the open, and with it the thread making thumbnails.
std::optional<std::vector<std::byte>> read_staged_file(std::string_view path, size_t max_bytes);

/// Staged thumbnails, made one at a time on a thread of their own, every request for one path at
/// one edge answered by a single decode.
///
/// Handlers run on no lock of this object, so one may call any Cancel or `request`. `close`
/// returns once no handler is running on another thread, and answers nothing from then on.
class StagedThumbnails {
  public:
    /// Makes one thumbnail. Runs on the worker; what it throws is answered as a failure.
    using Make = std::function<Media(const std::string& path, uint32_t edge)>;
    using Cancel = std::function<void()>;

    struct Timing {
        /// A decode running longer is given up on: its requests are answered with a failure and
        /// a fresh thread takes the rest, so one file on a mount that stopped answering cannot
        /// hold up every later pick. Its thread is left to finish, its answer dropped.
        std::chrono::milliseconds stuck_after = std::chrono::seconds{30};
        /// How long `close` waits for a decode under way, which uses libraries whose statics
        /// `exit` destroys. Bounded, so a stuck one cannot hold up a quit.
        std::chrono::milliseconds settle_at_close = std::chrono::seconds{2};
    };

    explicit StagedThumbnails(Make make);
    StagedThumbnails(Make make, Timing timing);
    ~StagedThumbnails();

    StagedThumbnails(const StagedThumbnails&) = delete;
    StagedThumbnails& operator=(const StagedThumbnails&) = delete;

    /// Answers `cb` with `path`'s thumbnail at `edge`, made once for every request for both.
    ///
    /// The cancel answers `cb` with "cancelled" if it has not been answered yet, and a path whose
    /// every request is cancelled before its turn is not made. Any thread, any number of times,
    /// from a handler too.
    Cancel request(std::string path, uint32_t edge, MediaHandler cb);

    /// Drops every handler unanswered. Idempotent; from a handler, it does not wait for that
    /// handler.
    void close();

  private:
    struct State;
    std::shared_ptr<State> _state;
};

/// A request made later, on another thread, which its cancel withdraws whether it comes before,
/// during or after the request is made. No lock is held while making it, so an answer given at
/// once may withdraw it.
class Deferred {
  public:
    Deferred();

    /// Makes the request with `make`, unless it was withdrawn first: then `withdrawn` runs instead.
    void make(
            const std::function<StagedThumbnails::Cancel()>& make,
            const std::function<void()>& withdrawn);

    /// Withdraws it, once; any thread, any number of times.
    StagedThumbnails::Cancel canceller() const;

  private:
    struct State;
    std::shared_ptr<State> _state;
};

}  // namespace session_bridge
