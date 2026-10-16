#include <session_bridge/staged_thumbnails.hpp>
#include <session_bridge/worker.hpp>

#include <algorithm>
#include <mutex>
#include <unordered_map>
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
    const int fd = ::open(name.c_str(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
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
        uint32_t edge = 0;
        bool started = false;
        std::vector<Waiter> waiting;
    };

    explicit State(Make make) : make{std::move(make)} {}

    Make make;
    Worker worker;
    std::mutex lock;
    bool open = true;
    uint64_t next_id = 0;
    std::unordered_map<std::string, Pending> pending;

    // On the worker: makes `path` unless every request for it has gone, then answers whoever is
    // still waiting. Answers under the lock, so `close` returning means no handler is running.
    static void make_one(const std::shared_ptr<State>& state, const std::string& path) {
        uint32_t edge;
        {
            std::lock_guard guard{state->lock};
            auto found = state->pending.find(path);
            if (!state->open || found == state->pending.end())
                return;
            found->second.started = true;
            edge = found->second.edge;
        }
        Media media = state->make(path, edge);
        std::vector<Waiter> waiting;
        std::lock_guard guard{state->lock};
        if (!state->open)
            return;
        if (auto found = state->pending.find(path); found != state->pending.end()) {
            waiting = std::move(found->second.waiting);
            state->pending.erase(found);
        }
        for (size_t i = 0; i < waiting.size(); i++)
            waiting[i].cb(i + 1 == waiting.size() ? std::move(media) : media);
    }
};

StagedThumbnails::StagedThumbnails(Make make) : _state{std::make_shared<State>(std::move(make))} {}

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
    const uint64_t id = _state->next_id++;
    auto [entry, fresh] = _state->pending.try_emplace(path);
    entry->second.waiting.push_back({id, std::move(cb)});
    if (fresh) {
        entry->second.edge = edge;
        const bool posted = _state->worker.post(
                [state = _state, path] { State::make_one(state, path); });
        if (!posted) {
            auto waiting = std::move(entry->second.waiting);
            _state->pending.erase(entry);
            guard.unlock();
            for (auto& waiter : waiting)
                waiter.cb(Media{"the thumbnail could not be started", {}, {}});
            return [] {};
        }
    }

    return [weak = std::weak_ptr<State>{_state}, path = std::move(path), id] {
        auto state = weak.lock();
        if (!state)
            return;
        MediaHandler cb;
        {
            std::lock_guard guard{state->lock};
            auto found = state->pending.find(path);
            if (!state->open || found == state->pending.end())
                return;
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
        }
        if (cb)
            cb(Media{"cancelled", {}, {}});
    };
}

void StagedThumbnails::close() {
    std::unordered_map<std::string, State::Pending> dropped;
    {
        std::lock_guard guard{_state->lock};
        if (!_state->open)
            return;
        _state->open = false;
        dropped.swap(_state->pending);
    }
    _state->worker.stop();
}

}  // namespace session_bridge
