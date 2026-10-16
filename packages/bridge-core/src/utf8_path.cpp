#include <session_bridge/utf8_path.hpp>
#include <stdexcept>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

namespace session_bridge {

#ifdef _WIN32

std::filesystem::path utf8_path(std::string_view utf8) {
    if (utf8.empty())
        return {};
    const int size = static_cast<int>(utf8.size());
    const int wide_size =
            MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(), size, nullptr, 0);
    if (wide_size <= 0)
        throw std::invalid_argument{"path is not valid UTF-8"};
    std::wstring wide(static_cast<size_t>(wide_size), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(), size, wide.data(), wide_size);
    return std::filesystem::path{std::move(wide)};
}

std::string utf8_string(const std::filesystem::path& path) {
    const std::wstring& wide = path.native();
    if (wide.empty())
        return {};
    const int size = static_cast<int>(wide.size());
    // Not WC_ERR_INVALID_CHARS: a lone surrogate in a name NTFS allowed becomes U+FFFD rather
    // than failing the answer for a file that does exist.
    const int utf8_size =
            WideCharToMultiByte(CP_UTF8, 0, wide.data(), size, nullptr, 0, nullptr, nullptr);
    std::string out(static_cast<size_t>(utf8_size > 0 ? utf8_size : 0), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wide.data(), size, out.data(), utf8_size, nullptr, nullptr);
    return out;
}

#else

std::filesystem::path utf8_path(std::string_view utf8) {
    return std::filesystem::path{utf8};
}

std::string utf8_string(const std::filesystem::path& path) {
    return path.string();
}

#endif

}  // namespace session_bridge
