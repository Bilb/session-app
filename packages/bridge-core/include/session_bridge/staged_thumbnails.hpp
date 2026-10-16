#pragma once

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

/// Staged thumbnails, made one at a time on a thread of their own, every request for one path
/// answered by a single decode.
///
/// `close` returns at once and answers nothing from then on: a decode under way, which may be
/// stuck on a mount that stopped answering, finishes on its own thread and its answer is dropped.
class StagedThumbnails {
  public:
    /// Makes one thumbnail. Runs on the worker; must not throw.
    using Make = std::function<Media(const std::string& path, uint32_t edge)>;
    using Cancel = std::function<void()>;

    explicit StagedThumbnails(Make make);
    ~StagedThumbnails();

    StagedThumbnails(const StagedThumbnails&) = delete;
    StagedThumbnails& operator=(const StagedThumbnails&) = delete;

    /// Answers `cb` with `path`'s thumbnail at `edge`, or at the edge of a request for the same
    /// path already waiting. A handler must not call back into this object.
    ///
    /// The cancel answers `cb` with "cancelled" if it has not been answered yet, and a path whose
    /// every request is cancelled before its turn is not made. Any thread, any number of times.
    Cancel request(std::string path, uint32_t edge, MediaHandler cb);

    /// Drops every handler unanswered. Idempotent.
    void close();

  private:
    struct State;
    std::shared_ptr<State> _state;
};

}  // namespace session_bridge
