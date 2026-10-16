// The bridge's staged-thumbnail thread, under ThreadSanitizer: what it runs, what it drops on stop,
// and that stopping waits out the job already running.

#include <session_bridge/worker.hpp>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <memory>
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

void runs_jobs_in_order_on_one_thread() {
    session_bridge::Worker worker;
    std::vector<int> order;
    std::atomic<int> done = 0;
    std::thread::id first{};
    std::atomic<bool> one_thread = true;
    for (int i = 0; i < 100; i++)
        worker.post([&, i] {
            if (i == 0)
                first = std::this_thread::get_id();
            else if (std::this_thread::get_id() != first)
                one_thread = false;
            order.push_back(i);
            done++;
        });
    for (int i = 0; i < 2000 && done < 100; i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    worker.stop();
    check(done == 100, "not every job ran");
    check(one_thread, "jobs ran on more than one thread");
    bool ordered = true;
    for (int i = 0; i < static_cast<int>(order.size()); i++)
        ordered = ordered && order[i] == i;
    check(ordered, "jobs ran out of order");
}

void stopping_waits_for_the_running_job_and_drops_the_rest() {
    session_bridge::Worker worker;
    std::atomic<bool> started = false, finished = false;
    std::atomic<int> ran_after = 0;
    auto dropped = std::make_shared<int>(0);
    std::weak_ptr<int> watch = dropped;
    worker.post([&] {
        started = true;
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        finished = true;
    });
    worker.post([&, keep = std::move(dropped)] { ran_after++; });
    for (int i = 0; i < 2000 && !started; i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    worker.stop();
    check(finished, "stop returned before the running job finished");
    check(ran_after == 0, "a queued job ran after stop");
    check(watch.expired(), "a dropped job was not destroyed");

    auto late = std::make_shared<int>(0);
    std::weak_ptr<int> watch_late = late;
    worker.post([&, keep = std::move(late)] { ran_after++; });
    check(ran_after == 0 && watch_late.expired(), "a job posted after stop was kept");
    worker.stop();
}

void a_worker_never_posted_to_stops_at_once() {
    session_bridge::Worker worker;
    worker.stop();
    worker.stop();
}

}  // namespace

int main() {
    runs_jobs_in_order_on_one_thread();
    stopping_waits_for_the_running_job_and_drops_the_rest();
    a_worker_never_posted_to_stops_at_once();
    if (failures == 0)
        std::puts("worker: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
