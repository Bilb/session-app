// Staged thumbnails under ThreadSanitizer, with the decode stubbed: one decode per path and edge,
// cancels that stop a decode nobody wants, handlers free to call back in, a watchdog for a decode
// that never ends, a close that waits only so long, and a reader that refuses what would block it.

#include <session_bridge/staged_thumbnails.hpp>

#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <mutex>
#include <optional>
#include <set>
#include <string>
#include <thread>
#include <vector>

namespace {

using session_bridge::Deferred;
using session_bridge::Media;
using session_bridge::StagedThumbnails;
using namespace std::chrono_literals;

// A close that never waits, and a watchdog that never fires, for tests about neither.
constexpr StagedThumbnails::Timing PROMPT{.stuck_after = 60s, .settle_at_close = 0ms};

int failures = 0;

void check(bool ok, const char* what) {
    if (!ok) {
        std::fprintf(stderr, "staged_thumbnails: %s\n", what);
        failures++;
    }
}

template <typename Done>
void wait_for(Done done) {
    for (int i = 0; i < 5000 && !done(); i++)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
}

// A decode that waits for `release`, and counts what it was asked to make.
struct Stub {
    std::atomic<bool> release = false;
    std::atomic<int> started = 0;
    std::mutex lock;
    std::vector<std::string> made;

    StagedThumbnails::Make make() {
        return [this](const std::string& path, uint32_t) {
            started++;
            while (!release)
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
            std::lock_guard guard{lock};
            made.push_back(path);
            return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}, std::byte{0xD8}}};
        };
    }

    size_t count(const std::string& path) {
        std::lock_guard guard{lock};
        return static_cast<size_t>(std::count(made.begin(), made.end(), path));
    }
};

struct Answers {
    std::mutex lock;
    std::vector<std::optional<std::string>> errors;

    session_bridge::MediaHandler handler() {
        return [this](Media media) {
            std::lock_guard guard{lock};
            errors.push_back(media.error);
        };
    }

    size_t size() {
        std::lock_guard guard{lock};
        return errors.size();
    }
};

void one_decode_answers_every_request_for_a_path() {
    auto stub = std::make_shared<Stub>();
    StagedThumbnails staged{stub->make(), PROMPT};
    Answers answers;
    for (int i = 0; i < 3; i++)
        staged.request("/a.jpg", 240, answers.handler());
    stub->release = true;
    wait_for([&] { return answers.size() == 3; });
    check(answers.size() == 3, "not every request was answered");
    check(stub->count("/a.jpg") == 1, "one path was decoded more than once");
    for (auto& error : answers.errors)
        check(!error, "a request was answered with an error");
}

void a_cancelled_path_is_never_decoded() {
    auto stub = std::make_shared<Stub>();
    StagedThumbnails staged{stub->make(), PROMPT};
    Answers first, second;
    staged.request("/busy.jpg", 240, first.handler());
    auto cancel = staged.request("/scrolled-away.jpg", 240, second.handler());
    cancel();
    cancel();
    check(second.size() == 1 && second.errors[0] == "cancelled", "a cancel was not answered once");
    stub->release = true;
    wait_for([&] { return first.size() == 1; });
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
    check(stub->count("/scrolled-away.jpg") == 0, "a cancelled path was decoded");
    check(second.size() == 1, "a cancelled request was answered again");
}

void closing_returns_while_a_decode_is_blocked_and_answers_nothing_after() {
    auto stub = std::make_shared<Stub>();
    auto staged = std::make_unique<StagedThumbnails>(stub->make(), PROMPT);
    Answers answers;
    staged->request("/stuck.jpg", 240, answers.handler());
    std::this_thread::sleep_for(std::chrono::milliseconds(10));

    const auto before = std::chrono::steady_clock::now();
    staged->close();
    check(std::chrono::steady_clock::now() - before < std::chrono::milliseconds(500),
          "close waited for the decode");

    Answers late;
    staged->request("/late.jpg", 240, late.handler());
    check(late.size() == 1 && late.errors[0] == "the bridge is closed",
          "a request after close was not refused");

    staged.reset();
    stub->release = true;
    wait_for([&] { return stub->count("/stuck.jpg") == 1; });
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
    check(answers.size() == 0, "a decode finished after close was answered");
}

void a_handler_withdrawing_its_own_request_may_ask_again() {
    auto stub = std::make_shared<Stub>();
    StagedThumbnails staged{stub->make(), PROMPT};
    auto cancel = std::make_shared<StagedThumbnails::Cancel>();
    std::atomic<bool> returned = false;
    Answers again;
    *cancel = staged.request("/a.jpg", 240, [&, cancel](Media) {
        (*cancel)();
        staged.request("/b.jpg", 240, again.handler());
        returned = true;
    });
    stub->release = true;
    wait_for([&] { return returned && again.size() == 1; });
    check(returned, "a handler calling its own cancel did not return");
    check(again.size() == 1, "a request made from a handler was not answered");
}

void a_cancel_after_the_answer_answers_nothing() {
    auto stub = std::make_shared<Stub>();
    stub->release = true;
    StagedThumbnails staged{stub->make(), PROMPT};
    Answers answers;
    auto cancel = staged.request("/a.jpg", 240, answers.handler());
    wait_for([&] { return answers.size() == 1; });
    cancel();
    std::this_thread::sleep_for(20ms);
    check(answers.size() == 1 && !answers.errors[0], "a cancel after the answer answered again");
}

void a_request_joins_a_decode_already_running() {
    auto stub = std::make_shared<Stub>();
    StagedThumbnails staged{stub->make(), PROMPT};
    Answers first, second;
    staged.request("/a.jpg", 240, first.handler());
    wait_for([&] { return stub->started == 1; });
    staged.request("/a.jpg", 240, second.handler());
    stub->release = true;
    wait_for([&] { return first.size() == 1 && second.size() == 1; });
    check(first.size() == 1 && second.size() == 1, "a request joining a running decode was lost");
    check(stub->count("/a.jpg") == 1, "a running decode was made again for a joining request");
}

void a_started_decode_whose_requests_all_cancel_answers_nobody() {
    auto stub = std::make_shared<Stub>();
    StagedThumbnails staged{stub->make(), PROMPT};
    Answers answers;
    auto cancel = staged.request("/a.jpg", 240, answers.handler());
    wait_for([&] { return stub->started == 1; });
    cancel();
    stub->release = true;
    wait_for([&] { return stub->count("/a.jpg") == 1; });
    std::this_thread::sleep_for(20ms);
    check(answers.size() == 1 && answers.errors[0] == "cancelled",
          "a cancelled request to a running decode was answered with the picture");

    Answers later;
    staged.request("/a.jpg", 240, later.handler());
    wait_for([&] { return later.size() == 1; });
    check(later.size() == 1 && !later.errors[0], "a path asked again after a cancel was not made");
}

void each_edge_is_its_own_decode() {
    std::mutex lock;
    std::vector<uint32_t> edges;
    StagedThumbnails staged{
            [&](const std::string&, uint32_t edge) {
                std::lock_guard guard{lock};
                edges.push_back(edge);
                return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
            },
            PROMPT};
    Answers small, large;
    staged.request("/a.jpg", 240, small.handler());
    staged.request("/a.jpg", 720, large.handler());
    wait_for([&] { return small.size() == 1 && large.size() == 1; });
    std::lock_guard guard{lock};
    check(edges.size() == 2, "two edges of one path shared a decode");
}

void a_decode_that_throws_is_answered_and_forgotten() {
    std::atomic<int> calls = 0;
    StagedThumbnails staged{
            [&](const std::string&, uint32_t) -> Media {
                if (calls++ == 0)
                    throw 42;
                return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
            },
            PROMPT};
    Answers first, second;
    staged.request("/a.jpg", 240, first.handler());
    wait_for([&] { return first.size() == 1; });
    check(first.size() == 1 && first.errors[0], "a decode that threw was not answered as a failure");
    staged.request("/a.jpg", 240, second.handler());
    wait_for([&] { return second.size() == 1; });
    check(second.size() == 1 && !second.errors[0], "a path whose decode threw could not be asked again");
}

void a_stuck_decode_is_given_up_on_and_the_rest_go_on() {
    auto release = std::make_shared<std::atomic<bool>>(false);
    StagedThumbnails staged{
            [release](const std::string& path, uint32_t) {
                if (path == "/stuck.jpg")
                    while (!*release)
                        std::this_thread::sleep_for(1ms);
                return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
            },
            {.stuck_after = 100ms, .settle_at_close = 0ms}};
    Answers stuck, after;
    staged.request("/stuck.jpg", 240, stuck.handler());
    staged.request("/fine.jpg", 240, after.handler());
    wait_for([&] { return stuck.size() == 1 && after.size() == 1; });
    check(stuck.size() == 1 && stuck.errors[0] == "the file could not be read",
          "a stuck decode was not given up on");
    check(after.size() == 1 && !after.errors[0], "a request behind a stuck decode was not made");
    *release = true;
    std::this_thread::sleep_for(50ms);
    check(stuck.size() == 1, "a decode given up on was answered again when it ended");
}

void closing_waits_only_so_long_for_a_decode_given_up_on() {
    for (const bool ends : {true, false}) {
        auto release = std::make_shared<std::atomic<bool>>(false);
        StagedThumbnails staged{
                [release](const std::string&, uint32_t) {
                    while (!*release)
                        std::this_thread::sleep_for(1ms);
                    return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
                },
                {.stuck_after = 50ms, .settle_at_close = 300ms}};
        Answers answers;
        staged.request("/a.jpg", 240, answers.handler());
        wait_for([&] { return answers.size() == 1; });
        std::thread ender;
        if (ends)
            ender = std::thread{[release] {
                std::this_thread::sleep_for(50ms);
                *release = true;
            }};
        const auto before = std::chrono::steady_clock::now();
        staged.close();
        const auto took = std::chrono::steady_clock::now() - before;
        if (ends) {
            ender.join();
            check(took >= 40ms && took < 280ms, "close did not wait for a decode given up on");
        } else {
            check(took >= 280ms && took < 1s,
                  "close did not keep to its bound for a decode given up on");
            *release = true;
        }
    }
}

void a_throwing_handler_leaves_the_rest_of_its_batch_answered() {
    for (const bool stuck : {false, true}) {
        auto release = std::make_shared<std::atomic<bool>>(false);
        auto started = std::make_shared<std::atomic<bool>>(false);
        StagedThumbnails staged{
                [release, started](const std::string&, uint32_t) {
                    *started = true;
                    while (!*release)
                        std::this_thread::sleep_for(1ms);
                    return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
                },
                {.stuck_after = stuck ? 50ms : 60s, .settle_at_close = 0ms}};
        Answers rest;
        staged.request("/a.jpg", 240, [](Media) { throw 42; });
        staged.request("/a.jpg", 240, rest.handler());
        staged.request("/a.jpg", 240, rest.handler());
        wait_for([&] { return started->load(); });
        if (!stuck)
            *release = true;
        wait_for([&] { return rest.size() == 2; });
        check(rest.size() == 2, stuck ? "a throwing handler cut short a batch given up on"
                                      : "a throwing handler cut short a batch decoded");
        *release = true;
    }
}

// A decode that never ends for a path under /stuck until that path is let go.
struct StuckMount : std::enable_shared_from_this<StuckMount> {
    std::mutex lock;
    std::set<std::string> released;
    std::atomic<int> started = 0;

    StagedThumbnails::Make make() {
        return [self = shared_from_this()](const std::string& path, uint32_t) {
            self->started++;
            while (path.starts_with("/stuck") && !self->is_released(path))
                std::this_thread::sleep_for(1ms);
            return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
        };
    }

    bool is_released(const std::string& path) {
        std::lock_guard guard{lock};
        return released.contains(path);
    }

    void release(const std::string& path) {
        std::lock_guard guard{lock};
        released.insert(path);
    }

    void release_all() {
        for (const std::string path : {"/stuck.jpg", "/stuck0", "/stuck1", "/stuck2", "/stuck3"})
            release(path);
    }
};

void a_path_given_up_on_is_refused_at_once() {
    auto mount = std::make_shared<StuckMount>();
    StagedThumbnails staged{mount->make(), {.stuck_after = 50ms, .settle_at_close = 0ms}};
    Answers first, queued;
    staged.request("/stuck.jpg", 240, first.handler());
    staged.request("/stuck.jpg", 720, queued.handler());
    wait_for([&] { return first.size() == 1 && queued.size() == 1; });
    check(queued.size() == 1 && queued.errors[0] == "the file could not be read",
          "another edge of a path given up on was not refused with it");

    Answers again;
    staged.request("/stuck.jpg", 240, again.handler());
    check(again.size() == 1 && again.errors[0] == "the file could not be read",
          "a path given up on was not refused at once");
    std::this_thread::sleep_for(20ms);
    check(mount->started == 1, "a path given up on was decoded again");
    mount->release_all();

    // Once the stuck decode returns, the mount answers again and so does the path.
    bool decoded = false;
    for (int i = 0; i < 200 && !decoded; i++) {
        Answers later;
        staged.request("/stuck.jpg", 240, later.handler());
        wait_for([&] { return later.size() == 1; });
        decoded = later.size() == 1 && !later.errors[0].has_value();
        if (!decoded)
            std::this_thread::sleep_for(10ms);
    }
    check(decoded, "a path stayed refused after its stuck decode returned");
}

void past_the_cap_on_decodes_given_up_on_requests_fail_at_once() {
    constexpr size_t cap = StagedThumbnails::MAX_ABANDONED_DECODES;
    static_assert(cap <= 4, "StuckMount lets go of four paths");
    auto mount = std::make_shared<StuckMount>();
    StagedThumbnails staged{mount->make(), {.stuck_after = 50ms, .settle_at_close = 0ms}};
    Answers stuck, behind;
    for (size_t i = 0; i < cap; i++)
        staged.request("/stuck" + std::to_string(i), 240, stuck.handler());
    staged.request("/fine-behind.jpg", 240, behind.handler());
    wait_for([&] { return stuck.size() == cap && behind.size() == 1; });
    check(behind.size() == 1 && behind.errors[0] == "the thumbnail could not be started",
          "a request queued behind the cap was decoded");

    Answers refused;
    staged.request("/fine.jpg", 240, refused.handler());
    check(refused.size() == 1 && refused.errors[0] == "the thumbnail could not be started",
          "a request past the cap was not refused at once");
    check(mount->started == static_cast<int>(cap), "a decode started past the cap");

    mount->release("/stuck0");
    bool decoded = false;
    for (int i = 0; i < 5000 && !decoded; i++) {
        Answers after;
        staged.request("/fine.jpg", 240, after.handler());
        wait_for([&] { return after.size() == 1; });
        decoded = after.size() == 1 && !after.errors[0];
        if (!decoded)
            std::this_thread::sleep_for(1ms);
    }
    check(decoded, "a request once a stuck decode ended was refused");
    mount->release_all();
}

void closing_waits_only_so_long_for_a_decode() {
    for (const bool ends : {true, false}) {
        auto release = std::make_shared<std::atomic<bool>>(false);
        auto started = std::make_shared<std::atomic<bool>>(false);
        StagedThumbnails staged{
                [release, started](const std::string&, uint32_t) {
                    *started = true;
                    while (!*release)
                        std::this_thread::sleep_for(1ms);
                    return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
                },
                {.stuck_after = 60s, .settle_at_close = 300ms}};
        Answers answers;
        staged.request("/a.jpg", 240, answers.handler());
        wait_for([&] { return started->load(); });
        std::thread ender;
        if (ends)
            ender = std::thread{[release] {
                std::this_thread::sleep_for(50ms);
                *release = true;
            }};
        const auto before = std::chrono::steady_clock::now();
        staged.close();
        const auto took = std::chrono::steady_clock::now() - before;
        if (ends) {
            ender.join();
            check(took >= 40ms && took < 280ms, "close did not wait for a decode about to end");
        } else {
            check(took >= 280ms && took < 1s, "close waited past its bound");
            *release = true;
        }
        std::this_thread::sleep_for(20ms);
        check(answers.size() == 0, "a decode was answered after close");
    }
}

void closing_waits_for_a_handler_running_on_another_thread() {
    enum class By { worker, watchdog, cancel };
    for (const By by : {By::worker, By::watchdog, By::cancel}) {
        auto release = std::make_shared<std::atomic<bool>>(by == By::worker);
        StagedThumbnails staged{
                [release](const std::string&, uint32_t) {
                    while (!*release)
                        std::this_thread::sleep_for(1ms);
                    return Media{std::nullopt, "image/jpeg", {std::byte{0xFF}}};
                },
                {.stuck_after = by == By::watchdog ? 50ms : 60s, .settle_at_close = 0ms}};
        std::atomic<bool> entered = false, returned = false;
        auto cancel = staged.request("/a.jpg", 240, [&](Media) {
            entered = true;
            std::this_thread::sleep_for(200ms);
            returned = true;
        });
        std::thread canceller;
        if (by == By::cancel)
            canceller = std::thread{[&] { cancel(); }};
        wait_for([&] { return entered.load(); });
        staged.close();
        check(returned, by == By::worker     ? "close returned during a handler on the worker"
                        : by == By::watchdog ? "close returned during a handler on the watchdog"
                                             : "close returned during a cancel's handler");
        if (canceller.joinable())
            canceller.join();
        *release = true;
    }
}

void a_handler_may_close() {
    auto stub = std::make_shared<Stub>();
    stub->release = true;
    StagedThumbnails staged{stub->make(), PROMPT};
    std::atomic<bool> returned = false;
    staged.request("/a.jpg", 240, [&](Media) {
        staged.close();
        returned = true;
    });
    wait_for([&] { return returned.load(); });
    check(returned, "close from a handler waited for that handler");
}

void a_deferred_request_is_withdrawn_whenever_the_cancel_comes() {
    // Before it is made: never made, and the withdrawn answer runs instead.
    {
        Deferred deferred;
        deferred.canceller()();
        bool made = false, withdrawn = false;
        deferred.make([&] { made = true; return StagedThumbnails::Cancel{[] {}}; }, [&] { withdrawn = true; });
        check(!made && withdrawn, "a request withdrawn before it was made was made");
    }
    // After: the request's own cancel runs, once.
    {
        Deferred deferred;
        int cancels = 0;
        deferred.make([&] { return StagedThumbnails::Cancel{[&] { cancels++; }}; }, [] {});
        auto cancel = deferred.canceller();
        cancel();
        cancel();
        check(cancels == 1, "a made request's cancel did not run exactly once");
    }
    // During: the request answers at once and withdraws itself from inside that answer.
    {
        Deferred deferred;
        int cancels = 0;
        deferred.make(
                [&] {
                    deferred.canceller()();
                    return StagedThumbnails::Cancel{[&] { cancels++; }};
                },
                [] {});
        check(cancels == 1, "a request withdrawn while it was made was not cancelled");
    }
}

void the_reader_refuses_what_is_not_a_regular_file() {
    const auto dir = std::filesystem::temp_directory_path() /
                     ("staged-read-" + std::to_string(::getpid()));
    std::filesystem::create_directories(dir);
    const auto file = dir / "photo.jpg";
    std::ofstream{file, std::ios::binary} << "picture";
    const auto fifo = dir / "fifo.jpg";
    ::mkfifo(fifo.c_str(), 0600);
    const auto device = dir / "zero.jpg";
    std::filesystem::create_symlink("/dev/zero", device);

    auto read = session_bridge::read_staged_file(file.string(), 1024);
    check(read && read->size() == 7, "a regular file was not read");
    check(!session_bridge::read_staged_file(file.string(), 6), "a file over the limit was read");
    // Would block for a writer if opened blocking.
    check(!session_bridge::read_staged_file(fifo.string(), 1024), "a FIFO was read");
    check(!session_bridge::read_staged_file(dir.string(), 1024), "a directory was read");
    check(!session_bridge::read_staged_file(device.string(), 1024), "a device was read");
    check(!session_bridge::read_staged_file((dir / "missing.jpg").string(), 1024),
          "a missing file was read");
    std::filesystem::remove_all(dir);
}

}  // namespace

int main() {
    one_decode_answers_every_request_for_a_path();
    a_cancelled_path_is_never_decoded();
    closing_returns_while_a_decode_is_blocked_and_answers_nothing_after();
    a_handler_withdrawing_its_own_request_may_ask_again();
    a_cancel_after_the_answer_answers_nothing();
    a_request_joins_a_decode_already_running();
    a_started_decode_whose_requests_all_cancel_answers_nobody();
    each_edge_is_its_own_decode();
    a_decode_that_throws_is_answered_and_forgotten();
    a_stuck_decode_is_given_up_on_and_the_rest_go_on();
    closing_waits_only_so_long_for_a_decode_given_up_on();
    a_throwing_handler_leaves_the_rest_of_its_batch_answered();
    a_path_given_up_on_is_refused_at_once();
    past_the_cap_on_decodes_given_up_on_requests_fail_at_once();
    closing_waits_only_so_long_for_a_decode();
    closing_waits_for_a_handler_running_on_another_thread();
    a_handler_may_close();
    a_deferred_request_is_withdrawn_whenever_the_cancel_comes();
    the_reader_refuses_what_is_not_a_regular_file();
    if (failures == 0)
        std::puts("staged_thumbnails: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
