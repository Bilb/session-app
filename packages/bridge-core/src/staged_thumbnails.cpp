#include <session_bridge/staged_thumbnails.hpp>
#include <session_bridge/worker.hpp>

#include <algorithm>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <optional>
#include <system_error>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <utility>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <cerrno>
#endif

namespace session_bridge {

#ifdef _WIN32

std::optional<std::vector<std::byte>> read_staged_file(std::string_view path, size_t max_bytes) {
    const int wide_size = MultiByteToWideChar(
            CP_UTF8, MB_ERR_INVALID_CHARS, path.data(), static_cast<int>(path.size()), nullptr, 0);
    if (wide_size <= 0)
        return std::nullopt;
    std::wstring wide(static_cast<size_t>(wide_size), L'\0');
    MultiByteToWideChar(
            CP_UTF8,
            MB_ERR_INVALID_CHARS,
            path.data(),
            static_cast<int>(path.size()),
            wide.data(),
            wide_size);

    HANDLE file = CreateFileW(
            wide.c_str(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            nullptr);
    if (file == INVALID_HANDLE_VALUE)
        return std::nullopt;
    std::optional<std::vector<std::byte>> out;
    LARGE_INTEGER size;
    // A disk file, not a pipe or a device such as CON, which a drive path can still name.
    if (GetFileType(file) == FILE_TYPE_DISK && GetFileSizeEx(file, &size) && size.QuadPart >= 0 &&
        static_cast<unsigned long long>(size.QuadPart) <= max_bytes) {
        std::vector<std::byte> bytes(static_cast<size_t>(size.QuadPart));
        size_t got = 0;
        while (got < bytes.size()) {
            DWORD n = 0;
            const auto want = static_cast<DWORD>(std::min<size_t>(bytes.size() - got, 1u << 20));
            if (!ReadFile(file, bytes.data() + got, want, &n, nullptr) || n == 0)
                break;
            got += n;
        }
        if (got == bytes.size())
            out = std::move(bytes);
    }
    CloseHandle(file);
    return out;
}

#else

std::optional<std::vector<std::byte>> read_staged_file(std::string_view path, size_t max_bytes) {
    const std::string name{path};
    // Non-blocking, so a FIFO opens at once rather than waiting for a writer; refused just below.
    const int fd = ::open(name.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC | O_NOCTTY);
    if (fd < 0)
        return std::nullopt;
    std::optional<std::vector<std::byte>> out;
    struct stat info {};
    if (::fstat(fd, &info) == 0 && S_ISREG(info.st_mode) && info.st_size >= 0 &&
        static_cast<unsigned long long>(info.st_size) <= max_bytes) {
        std::vector<std::byte> bytes(static_cast<size_t>(info.st_size));
        size_t got = 0;
        while (got < bytes.size()) {
            const ssize_t n = ::read(fd, bytes.data() + got, bytes.size() - got);
            if (n < 0 && errno == EINTR)
                continue;
            if (n <= 0)
                break;
            got += static_cast<size_t>(n);
        }
        if (got == bytes.size())
            out = std::move(bytes);
    }
    ::close(fd);
    return out;
}

#endif

struct StagedThumbnails::State {
    struct Waiter {
        uint64_t id;
        MediaHandler cb;
    };
    struct Pending {
        std::string path;
        uint32_t edge = 0;
        bool started = false;
        std::vector<Waiter> waiting;
    };
    struct Running {
        std::string key;
        std::string path;
        uint64_t job;
        std::chrono::steady_clock::time_point since;
    };

    State(Make make, Timing timing) : make{std::move(make)}, timing{timing} {}

    Make make;
    Timing timing;
    std::mutex lock;
    // Wakes the watchdog when a decode starts or ends, and `close` when one ends or a handler
    // returns.
    std::condition_variable changed;
    bool open = true;
    bool watching = false;
    // The watchdog failed partway through a give-up, leaving the queue in no state to trust:
    // everything is refused from then on.
    bool broken = false;
    uint64_t next_id = 0;
    uint64_t next_job = 0;
    // Replaced when a decode is given up on. `generation` keeps a job of a replaced worker from
    // taking a key, whether or not `Worker::stop` dropped it.
    std::shared_ptr<Worker> worker = std::make_shared<Worker>();
    uint64_t generation = 0;
    // Keys in the order asked, one per job posted. A key whose entry was cancelled away is
    // skipped when its job comes.
    std::deque<std::string> queue;
    std::unordered_map<std::string, Pending> pending;
    std::optional<Running> running;
    // Given up on and still inside `make`, which `close` waits out as it does `running`.
    size_t abandoned_decodes = 0;
    // Refused until its decode returns: another would likely hold another thread for good.
    std::unordered_set<std::string> given_up_paths;
    // Threads running handlers, which `close` waits out unless it is one of them.
    std::vector<std::thread::id> answering;
    // A give-up's requests until it answers them, here rather than on its stack so that a give-up
    // that throws partway can still be answered.
    std::vector<Waiter> giving_up_unreadable;
    std::vector<Waiter> giving_up_refused;

    static std::string key_of(const std::string& path, uint32_t edge) {
        return std::to_string(edge) + '\n' + path;
    }

    // Runs `answer` with the lock released, counted as answering; returns with it held again.
    template <typename F>
    void answer_unlocked(std::unique_lock<std::mutex>& guard, F&& answer) {
        const auto me = std::this_thread::get_id();
        answering.push_back(me);
        guard.unlock();
        try {
            answer();
        } catch (...) {
        }
        guard.lock();
        answering.erase(std::find(answering.begin(), answering.end(), me));
        changed.notify_all();
    }

    // A try for each, so a handler that throws, or a copy that cannot be made, skips only its own.
    static void answer_each(std::vector<Waiter>& waiting, Media media) {
        for (size_t i = 0; i < waiting.size(); i++)
            try {
                waiting[i].cb(i + 1 == waiting.size() ? std::move(media) : media);
            } catch (...) {
            }
    }

    // Under the lock: one job for the key at the back of `queue`, on the current worker.
    bool post_one(const std::shared_ptr<State>& self) {
        return worker->post([self, generation = generation] { run_one(self, generation); });
    }

    // On a worker: makes the oldest key still wanted, then answers everyone waiting for it.
    static void run_one(const std::shared_ptr<State>& state, uint64_t generation) {
        std::unique_lock guard{state->lock};
        if (!state->open || generation != state->generation || state->queue.empty())
            return;
        std::string key = std::move(state->queue.front());
        state->queue.pop_front();
        auto found = state->pending.find(key);
        if (found == state->pending.end())
            return;
        found->second.started = true;
        const std::string path = found->second.path;
        const uint32_t edge = found->second.edge;
        const uint64_t job = state->next_job++;
        state->running = Running{key, path, job, std::chrono::steady_clock::now()};
        state->changed.notify_all();
        guard.unlock();

        Media media;
        try {
            media = state->make(path, edge);
        } catch (...) {
            media = Media{"the thumbnail could not be made", {}, {}};
        }

        guard.lock();
        // Given up on by the watchdog, which has answered its requests already.
        if (!state->running || state->running->job != job) {
            state->abandoned_decodes--;
            // It answered, so whatever held it up has let go: the path may be asked for again.
            state->given_up_paths.erase(path);
            state->changed.notify_all();
            return;
        }
        state->running.reset();
        state->changed.notify_all();
        found = state->pending.find(key);
        if (!state->open || found == state->pending.end())
            return;
        auto waiting = std::move(found->second.waiting);
        state->pending.erase(found);
        state->answer_unlocked(guard, [&] { answer_each(waiting, std::move(media)); });
    }

    // On a thread of its own while the object is open: gives up on a decode past `stuck_after`.
    static void watch(const std::shared_ptr<State>& state) {
        std::unique_lock guard{state->lock};
        while (state->open) {
            if (!state->running) {
                state->changed.wait(guard);
                continue;
            }
            const uint64_t job = state->running->job;
            const auto deadline = state->running->since + state->timing.stuck_after;
            if (state->changed.wait_until(guard, deadline, [&] {
                    return !state->open || !state->running || state->running->job != job;
                }))
                continue;

            auto& stuck = state->giving_up_unreadable;
            if (auto found = state->pending.find(state->running->key);
                found != state->pending.end()) {
                for (auto& waiter : found->second.waiting)
                    stuck.push_back(std::move(waiter));
                state->pending.erase(found);
            }
            state->given_up_paths.insert(state->running->path);
            state->running.reset();
            state->abandoned_decodes++;
            state->changed.notify_all();

            // The stuck thread is left where it is; the keys still queued go to a fresh one,
            // unless they would only be stuck too.
            state->worker->stop();
            state->worker = std::make_shared<Worker>();
            state->generation++;
            const bool held_up = state->abandoned_decodes >= MAX_ABANDONED_DECODES;
            auto& refused = state->giving_up_refused;
            const auto refuse = [&](const std::string& key, std::vector<Waiter>& into) {
                if (auto found = state->pending.find(key); found != state->pending.end()) {
                    for (auto& waiter : found->second.waiting)
                        into.push_back(std::move(waiter));
                    state->pending.erase(found);
                }
            };
            std::deque<std::string> queued;
            queued.swap(state->queue);
            for (auto& key : queued) {
                auto found = state->pending.find(key);
                if (found == state->pending.end())
                    continue;
                if (state->given_up_paths.contains(found->second.path))
                    refuse(key, stuck);
                else if (held_up)
                    refuse(key, refused);
                else
                    state->queue.push_back(std::move(key));
            }
            for (size_t i = 0; i < state->queue.size(); i++)
                if (!state->post_one(state)) {
                    for (auto& key : state->queue)
                        refuse(key, refused);
                    state->queue.clear();
                    break;
                }

            auto unreadable = std::exchange(stuck, {});
            auto not_started = std::exchange(refused, {});
            state->answer_unlocked(guard, [&] {
                answer_each(unreadable, Media{"the file could not be read", {}, {}});
                answer_each(not_started, Media{"the thumbnail could not be started", {}, {}});
            });
        }
    }
};

StagedThumbnails::StagedThumbnails(Make make) : StagedThumbnails{std::move(make), Timing{}} {}

StagedThumbnails::StagedThumbnails(Make make, Timing timing) :
        _state{std::make_shared<State>(std::move(make), timing)} {}

StagedThumbnails::~StagedThumbnails() {
    close();
}

StagedThumbnails::Cancel StagedThumbnails::request(
        std::string path, uint32_t edge, MediaHandler cb) {
    std::unique_lock guard{_state->lock};
    if (!_state->open) {
        guard.unlock();
        cb(Media{"the bridge is closed", {}, {}});
        return [] {};
    }
    if (!_state->watching) {
        try {
            std::thread{[state = _state] {
                try {
                    State::watch(state);
                } catch (...) {
                    // Out of memory mid give-up: refuse from here on rather than end the app.
                    try {
                        std::unique_lock guard{state->lock};
                        state->broken = true;
                        auto stranded = std::exchange(state->pending, {});
                        auto unreadable = std::exchange(state->giving_up_unreadable, {});
                        auto not_started = std::exchange(state->giving_up_refused, {});
                        state->queue.clear();
                        if (state->open)
                            state->answer_unlocked(guard, [&] {
                                const Media refusal{"the thumbnail could not be started", {}, {}};
                                State::answer_each(unreadable, refusal);
                                State::answer_each(not_started, refusal);
                                for (auto& [key, entry] : stranded)
                                    State::answer_each(entry.waiting, refusal);
                            });
                    } catch (...) {
                        // Nothing left to answer with; at least the app keeps running.
                    }
                }
            }}.detach();
            _state->watching = true;
        } catch (const std::system_error&) {
            // Without a watchdog a stuck decode holds up later ones, which is all it costs.
        }
    }

    const bool unreadable = _state->given_up_paths.contains(path);
    if (unreadable || _state->broken || _state->abandoned_decodes >= MAX_ABANDONED_DECODES) {
        guard.unlock();
        cb(Media{unreadable ? "the file could not be read" : "the thumbnail could not be started",
                 {},
                 {}});
        return [] {};
    }

    const uint64_t id = _state->next_id++;
    std::string key = State::key_of(path, edge);
    auto [entry, fresh] = _state->pending.try_emplace(key);
    entry->second.waiting.push_back({id, std::move(cb)});
    if (fresh) {
        entry->second.path = std::move(path);
        entry->second.edge = edge;
        _state->queue.push_back(key);
        if (!_state->post_one(_state)) {
            _state->queue.pop_back();
            auto waiting = std::move(entry->second.waiting);
            _state->pending.erase(entry);
            guard.unlock();
            for (auto& waiter : waiting)
                waiter.cb(Media{"the thumbnail could not be started", {}, {}});
            return [] {};
        }
    }

    return [weak = std::weak_ptr<State>{_state}, key = std::move(key), id] {
        auto state = weak.lock();
        if (!state)
            return;
        std::unique_lock guard{state->lock};
        auto found = state->pending.find(key);
        if (!state->open || found == state->pending.end())
            return;
        MediaHandler cb;
        auto& waiting = found->second.waiting;
        for (auto it = waiting.begin(); it != waiting.end(); ++it)
            if (it->id == id) {
                cb = std::move(it->cb);
                waiting.erase(it);
                break;
            }
        // Not yet started and nobody left to draw it: the job finds nothing and makes nothing.
        if (waiting.empty() && !found->second.started)
            state->pending.erase(found);
        if (cb)
            state->answer_unlocked(guard, [&] { cb(Media{"cancelled", {}, {}}); });
    };
}

void StagedThumbnails::close() {
    std::unordered_map<std::string, State::Pending> dropped;
    std::shared_ptr<Worker> worker;
    std::unique_lock guard{_state->lock};
    if (!_state->open)
        return;
    _state->open = false;
    dropped.swap(_state->pending);
    _state->queue.clear();
    _state->changed.notify_all();

    const auto me = std::this_thread::get_id();
    _state->changed.wait(guard, [&] {
        return std::ranges::all_of(_state->answering, [&](auto id) { return id == me; });
    });
    _state->changed.wait_for(guard, _state->timing.settle_at_close, [&] {
        return !_state->running && _state->abandoned_decodes == 0;
    });
    worker = _state->worker;
    guard.unlock();
    worker->stop();
}

struct Deferred::State {
    std::mutex lock;
    bool withdrawn = false;
    StagedThumbnails::Cancel cancel;
};

Deferred::Deferred() : _state{std::make_shared<State>()} {}

void Deferred::make(
        const std::function<StagedThumbnails::Cancel()>& make,
        const std::function<void()>& withdrawn) {
    bool already;
    {
        std::lock_guard guard{_state->lock};
        already = _state->withdrawn;
    }
    if (already) {
        withdrawn();
        return;
    }
    auto cancel = make();
    {
        std::lock_guard guard{_state->lock};
        if (!_state->withdrawn) {
            _state->cancel = std::move(cancel);
            return;
        }
    }
    // Withdrawn while it was being made.
    if (cancel)
        cancel();
}

StagedThumbnails::Cancel Deferred::canceller() const {
    return [state = _state] {
        StagedThumbnails::Cancel cancel;
        {
            std::lock_guard guard{state->lock};
            if (state->withdrawn)
                return;
            state->withdrawn = true;
            cancel = std::move(state->cancel);
        }
        if (cancel)
            cancel();
    };
}

}  // namespace session_bridge
