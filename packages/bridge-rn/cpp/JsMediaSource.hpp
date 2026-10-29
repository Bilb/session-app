#pragma once

#include "MediaSource.hpp"

#include <atomic>
#include <functional>
#include <memory>

namespace session_bridge_rn {

/// A media source JavaScript answers: the fake, which has no Client.
///
/// **Nothing JavaScript owns leaves the JS thread.** A loader calls from its own thread; the
/// request is posted to the JS thread, where `ask_*` calls into JavaScript and its answer, bytes
/// copied, reaches the handler. Every call is answered exactly once, with an error when the JS
/// thread is gone or the source closes first.
class JsMediaSource final : public MediaSource, public std::enable_shared_from_this<JsMediaSource> {
  public:
    /// Runs `job` on the JS thread, or returns false when there is no longer one to run it on.
    using OnJs = std::function<bool(std::function<void()> job)>;
    /// Called on the JS thread only; answers `cb` from any thread, once.
    using AskMedia =
            std::function<void(double message_id, double index, ::session_bridge::MediaHandler cb)>;
    using AskThumbhash = std::function<void(
            double message_id, double index, ::session_bridge::ThumbhashHandler cb)>;
    using AskStaged = std::function<void(std::string path, ::session_bridge::MediaHandler cb)>;

    /// A thumbnail, staged or not, is asked like a file: JPEG bytes, typed `image/jpeg`. So is a
    /// rendition, typed by what its bytes are.
    JsMediaSource(
            OnJs on_js,
            AskMedia ask_media,
            AskThumbhash ask_thumbhash,
            AskMedia ask_thumbnail,
            AskMedia ask_rendition,
            AskStaged ask_staged_thumbnail) :
            _on_js{std::move(on_js)},
            _ask_media{std::move(ask_media)},
            _ask_thumbhash{std::move(ask_thumbhash)},
            _ask_thumbnail{std::move(ask_thumbnail)},
            _ask_rendition{std::move(ask_rendition)},
            _ask_staged_thumbnail{std::move(ask_staged_thumbnail)} {}

    void fetch_media(double message_id, double index, ::session_bridge::MediaHandler cb) override;
    void fetch_thumbhash(
            double message_id, double index, ::session_bridge::ThumbhashHandler cb) override;
    void fetch_thumbnail(
            double message_id, double index, ::session_bridge::MediaHandler cb) override;
    void fetch_rendition(
            double message_id, double index, ::session_bridge::MediaHandler cb) override;
    /// A JavaScript source cannot withdraw a request, so the cancel does nothing.
    std::function<void()> fetch_staged_thumbnail(
            std::string path, ::session_bridge::MediaHandler cb) override;

    /// **On the JS thread**, so the functions holding JavaScript values are released there. Answers
    /// everything pending, and every call after.
    void close();

  private:
    OnJs _on_js;
    AskMedia _ask_media;
    AskThumbhash _ask_thumbhash;
    AskMedia _ask_thumbnail;
    AskMedia _ask_rendition;
    AskStaged _ask_staged_thumbnail;
    std::atomic<bool> _closed = false;
    std::shared_ptr<PendingAnswers> _pending = std::make_shared<PendingAnswers>();
};

}  // namespace session_bridge_rn
