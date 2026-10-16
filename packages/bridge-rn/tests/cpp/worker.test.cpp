// The bridge's staged-thumbnail thread, under ThreadSanitizer: what it runs, what it drops on stop,
// and that stopping never waits for the job already running.

#include <session_bridge/worker.hpp>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <stdexcept>
#include <thread>
#include <vector>

namespace {

int failures = 0;

void check(bool ok, const char* what) {
    if (!ok) {
        std::fprintf(stderr, "worker: %s\n", what);
        failures++;
    }
}

template <typename Done>
void wait_for(Done done) {
    for (int i = 0; i < 5000 && !done(); i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
}

void runs_jobs_in_order_on_one_thread() {
    session_bridge::Worker worker;
    auto order = std::make_shared<std::vector<int>>();
    auto done = std::make_shared<std::atomic<int>>(0);
    auto one_thread = std::make_shared<std::atomic<bool>>(true);
    auto first = std::make_shared<std::thread::id>();
    for (int i = 0; i < 100; i++)
        worker.post([=] {
            if (i == 0)
                *first = std::this_thread::get_id();
            else if (std::this_thread::get_id() != *first)
                *one_thread = false;
            order->push_back(i);
            (*done)++;
        });
    wait_for([&] { return *done == 100; });
    worker.stop();
    check(*done == 100, "not every job ran");
    check(*one_thread, "jobs ran on more than one thread");
    bool ordered = true;
    for (int i = 0; i < static_cast<int>(order->size()); i++)
        ordered = ordered && (*order)[i] == i;
    check(ordered, "jobs ran out of order");
}

void stopping_returns_while_a_job_is_blocked_and_drops_the_rest() {
    session_bridge::Worker worker;
    auto started = std::make_shared<std::atomic<bool>>(false);
    auto release = std::make_shared<std::atomic<bool>>(false);
    auto finished = std::make_shared<std::atomic<bool>>(false);
    auto ran_after = std::make_shared<std::atomic<int>>(0);
    auto dropped = std::make_shared<int>(0);
    std::weak_ptr<int> watch = dropped;
    worker.post([=] {
        *started = true;
        // Stands in for a read from a mount that stopped answering.
        while (!*release)
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        *finished = true;
    });
    worker.post([=, keep = std::move(dropped)] { (*ran_after)++; });
    wait_for([&] { return started->load(); });

    const auto before = std::chrono::steady_clock::now();
    worker.stop();
    check(std::chrono::steady_clock::now() - before < std::chrono::milliseconds(500),
          "stop waited for the running job");
    check(!*finished, "the blocked job finished before it was released");
    check(watch.expired(), "a dropped job was not destroyed");

    auto late = std::make_shared<int>(0);
    std::weak_ptr<int> watch_late = late;
    check(!worker.post([=, keep = std::move(late)] { (*ran_after)++; }),
          "a job posted after stop was accepted");
    check(watch_late.expired(), "a job posted after stop was kept");

    *release = true;
    wait_for([&] { return finished->load(); });
    check(*finished, "the running job did not finish once released");
    check(*ran_after == 0, "a queued job ran after stop");
}

void a_throwing_job_does_not_end_the_thread() {
    session_bridge::Worker worker;
    auto ran = std::make_shared<std::atomic<bool>>(false);
    worker.post([] { throw std::runtime_error{"thrown"}; });
    worker.post([=] { *ran = true; });
    wait_for([&] { return ran->load(); });
    check(*ran, "a job after a throwing one did not run");
}

void a_worker_never_posted_to_stops_at_once() {
    session_bridge::Worker worker;
    worker.stop();
    worker.stop();
}

}  // namespace

int main() {
    runs_jobs_in_order_on_one_thread();
    stopping_returns_while_a_job_is_blocked_and_drops_the_rest();
    a_throwing_job_does_not_end_the_thread();
    a_worker_never_posted_to_stops_at_once();
    if (failures == 0)
        std::puts("worker: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
