#include <session_bridge/worker.hpp>

#include <condition_variable>
#include <deque>
#include <mutex>
#include <system_error>
#include <thread>
#include <utility>

namespace session_bridge {

struct Worker::State {
    std::mutex lock;
    std::condition_variable wake;
    std::deque<std::function<void()>> jobs;
    bool stopping = false;
    bool started = false;

    static void run(std::shared_ptr<State> state) {
        for (;;) {
            std::function<void()> job;
            {
                std::unique_lock guard{state->lock};
                state->wake.wait(guard, [&] { return state->stopping || !state->jobs.empty(); });
                if (state->stopping)
                    return;
                job = std::move(state->jobs.front());
                state->jobs.pop_front();
            }
            // Escaping, an exception would end the process from a thread nobody joins.
            try {
                job();
            } catch (...) {
            }
        }
    }
};

Worker::Worker() : _state{std::make_shared<State>()} {}

Worker::~Worker() {
    stop();
}

bool Worker::post(std::function<void()> job) {
    std::unique_lock guard{_state->lock};
    if (_state->stopping) {
        guard.unlock();
        // Destroyed outside the lock: what a job captures may run anything on its way out.
        job = nullptr;
        return false;
    }
    if (!_state->started) {
        try {
            std::thread{State::run, _state}.detach();
        } catch (const std::system_error&) {
            guard.unlock();
            job = nullptr;
            return false;
        }
        _state->started = true;
    }
    _state->jobs.push_back(std::move(job));
    _state->wake.notify_one();
    return true;
}

void Worker::stop() {
    std::deque<std::function<void()>> dropped;
    {
        std::lock_guard guard{_state->lock};
        _state->stopping = true;
        dropped.swap(_state->jobs);
        _state->wake.notify_one();
    }
}

}  // namespace session_bridge
