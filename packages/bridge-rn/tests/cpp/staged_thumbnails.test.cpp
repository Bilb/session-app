// Staged thumbnails under ThreadSanitizer, with the decode stubbed: one decode per path, cancels
// that stop a decode nobody wants, a close that never waits, and a reader that refuses what would
// block it.

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
#include <string>
#include <thread>
#include <vector>

namespace {

using session_bridge::Media;
using session_bridge::StagedThumbnails;

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
    std::mutex lock;
    std::vector<std::string> made;

    StagedThumbnails::Make make() {
        return [this](const std::string& path, uint32_t) {
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
    StagedThumbnails staged{stub->make()};
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
    StagedThumbnails staged{stub->make()};
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
    auto staged = std::make_unique<StagedThumbnails>(stub->make());
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
    the_reader_refuses_what_is_not_a_regular_file();
    if (failures == 0)
        std::puts("staged_thumbnails: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
