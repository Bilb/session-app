#pragma once

#include <functional>
#include <memory>

namespace session_bridge {

/// One thread running jobs in the order posted, for work too slow for Core's loop or a caller's
/// thread. One rather than a pool: libvips already spreads a single decode over the cores.
///
/// The thread starts on the first `post`. `stop` returns at once: it destroys every queued job
/// without running it, and leaves the one running, which may be blocked on a file nobody can
/// reach, to finish on its own thread. A job must therefore hold whatever it uses.
class Worker {
  public:
    Worker();
    ~Worker();

    Worker(const Worker&) = delete;
    Worker& operator=(const Worker&) = delete;

    /// False when the job was not queued: after `stop`, or when no thread could be started. The
    /// job is destroyed unrun either way.
    bool post(std::function<void()> job);

    /// Idempotent, and safe from a job.
    void stop();

  private:
    struct State;
    std::shared_ptr<State> _state;
};

}  // namespace session_bridge
