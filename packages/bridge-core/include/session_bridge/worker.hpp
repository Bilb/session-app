#pragma once

#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>

namespace session_bridge {

/// One thread running jobs in the order posted, for work too slow for Core's loop or a caller's
/// thread. One rather than a pool: libvips already spreads a single decode over the cores.
///
/// The thread starts on the first `post`. Once `stop` is called, a job posted is destroyed without
/// running, and so is every job still queued; the one running is waited for.
class Worker {
  public:
    Worker() = default;
    ~Worker();

    Worker(const Worker&) = delete;
    Worker& operator=(const Worker&) = delete;

    void post(std::function<void()> job);

    /// Idempotent. Must not be called from a job: it joins the thread the job runs on.
    void stop();

  private:
    void run();

    std::mutex _lock;
    std::condition_variable _wake;
    std::deque<std::function<void()>> _jobs;
    bool _stopping = false;
    std::thread _thread;
};

}  // namespace session_bridge
