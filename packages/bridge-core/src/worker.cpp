#include <session_bridge/worker.hpp>

#include <utility>

namespace session_bridge {

Worker::~Worker() {
    stop();
}

void Worker::post(std::function<void()> job) {
    std::unique_lock lock{_lock};
    if (_stopping) {
        lock.unlock();
        // Destroyed outside the lock: what a job captures may run anything on its way out.
        job = nullptr;
        return;
    }
    _jobs.push_back(std::move(job));
    if (!_thread.joinable())
        _thread = std::thread{[this] { run(); }};
    _wake.notify_one();
}

void Worker::stop() {
    std::deque<std::function<void()>> dropped;
    std::thread thread;
    {
        std::lock_guard lock{_lock};
        _stopping = true;
        dropped.swap(_jobs);
        thread = std::move(_thread);
        _wake.notify_one();
    }
    dropped.clear();
    if (thread.joinable())
        thread.join();
}

void Worker::run() {
    for (;;) {
        std::function<void()> job;
        {
            std::unique_lock lock{_lock};
            _wake.wait(lock, [this] { return _stopping || !_jobs.empty(); });
            if (_stopping)
                return;
            job = std::move(_jobs.front());
            _jobs.pop_front();
        }
        job();
    }
}

}  // namespace session_bridge
