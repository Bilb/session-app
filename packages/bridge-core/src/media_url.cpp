#include <session_bridge/media_url.hpp>

#include <array>
#include <cstdint>
#include <utility>

namespace session_bridge {

namespace {

    constexpr std::string_view SCHEME = "session-media://";
    constexpr std::uint64_t MAX_SAFE_INTEGER = (std::uint64_t{1} << 53) - 1;

    /// One `/`-free decimal id off the front of `rest`, consuming it; nullopt unless it is `0` or
    /// has no leading zero, and fits a JavaScript number exactly.
    std::optional<std::uint64_t> take_id(std::string_view& rest) {
        std::size_t length = 0;
        while (length < rest.size() && rest[length] >= '0' && rest[length] <= '9')
            length++;
        if (length == 0 || length > 16 || (length > 1 && rest[0] == '0'))
            return std::nullopt;
        std::uint64_t id = 0;
        for (std::size_t i = 0; i < length; i++)
            id = id * 10 + static_cast<std::uint64_t>(rest[i] - '0');
        if (id > MAX_SAFE_INTEGER)
            return std::nullopt;
        rest.remove_prefix(length);
        return id;
    }

    bool take(std::string_view& rest, std::string_view prefix) {
        if (!rest.starts_with(prefix))
            return false;
        rest.remove_prefix(prefix.size());
        return true;
    }

    constexpr std::size_t MAX_STAGED_PATH_BYTES = 4096;

    bool unreserved(unsigned char c) {
        return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
               c == '.' || c == '_' || c == '~' || c == '-';
    }

    /// Strict UTF-8: no overlong form, surrogate, value past U+10FFFF or truncated sequence.
    bool valid_utf8(std::string_view text) {
        for (std::size_t i = 0; i < text.size();) {
            const auto lead = static_cast<unsigned char>(text[i]);
            const std::size_t length = lead < 0x80                    ? 1
                                     : lead >= 0xc2 && lead <= 0xdf ? 2
                                     : lead >= 0xe0 && lead <= 0xef ? 3
                                     : lead >= 0xf0 && lead <= 0xf4 ? 4
                                                                    : 0;
            if (length == 0 || i + length > text.size())
                return false;
            std::uint32_t code = length == 1 ? lead : lead & (0xffu >> (length + 1));
            for (std::size_t k = 1; k < length; k++) {
                const auto next = static_cast<unsigned char>(text[i + k]);
                if ((next & 0xc0) != 0x80)
                    return false;
                code = (code << 6) | (next & 0x3f);
            }
            constexpr std::array<std::uint32_t, 5> LEAST{0, 0, 0x80, 0x800, 0x10000};
            if (code < LEAST[length] || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
                return false;
            i += length;
        }
        return true;
    }

    std::string encode_staged(std::string_view path) {
        constexpr std::string_view HEX = "0123456789ABCDEF";
        std::string out;
        for (const char ch : path) {
            const auto c = static_cast<unsigned char>(ch);
            if (unreserved(c)) {
                out += ch;
            } else {
                out += '%';
                out += HEX[c >> 4];
                out += HEX[c & 0xf];
            }
        }
        return out;
    }

    int hex_digit(char c) {
        if (c >= '0' && c <= '9')
            return c - '0';
        if (c >= 'A' && c <= 'F')
            return c - 'A' + 10;
        return -1;
    }

    std::optional<std::string> parse_staged(std::string_view segment) {
        std::string path;
        for (std::size_t i = 0; i < segment.size();) {
            if (segment[i] != '%') {
                path += segment[i++];
                continue;
            }
            if (i + 2 >= segment.size())
                return std::nullopt;
            const int high = hex_digit(segment[i + 1]), low = hex_digit(segment[i + 2]);
            if (high < 0 || low < 0)
                return std::nullopt;
            path += static_cast<char>(high * 16 + low);
            i += 3;
        }
        // Re-encoding refuses every other spelling of the same path, so one path has one url.
        if (!is_staged_path(path) || encode_staged(path) != segment)
            return std::nullopt;
        return path;
    }

    enum class Family { image, video };

    struct Viewable {
        std::string_view type;
        Family family;
    };

    // `image/jpg` is not a registered type, but senders send it. The list is basic-types' media.ts.
    constexpr std::array<Viewable, 10> VIEWABLE{{
            {"image/bmp", Family::image},
            {"image/gif", Family::image},
            {"image/jpeg", Family::image},
            {"image/jpg", Family::image},
            {"image/png", Family::image},
            {"image/apng", Family::image},
            {"image/webp", Family::image},
            {"video/mp4", Family::video},
            {"video/webm", Family::video},
            {"video/ogg", Family::video},
    }};

    struct Run {
        std::size_t at;
        std::string_view bytes;
    };

    struct Signature {
        std::string_view type;
        Family family;
        std::array<Run, 2> runs;
    };

    using namespace std::string_view_literals;

    // Every run must match; an empty second run matches anything.
    constexpr std::array<Signature, 9> SIGNATURES{{
            {"image/png", Family::image, {{{0, "\x89PNG\r\n\x1a\n"sv}, {}}}},
            {"image/jpeg", Family::image, {{{0, "\xff\xd8\xff"sv}, {}}}},
            {"image/gif", Family::image, {{{0, "GIF87a"sv}, {}}}},
            {"image/gif", Family::image, {{{0, "GIF89a"sv}, {}}}},
            {"image/webp", Family::image, {{{0, "RIFF"sv}, {8, "WEBP"sv}}}},
            {"image/bmp", Family::image, {{{0, "BM"sv}, {}}}},
            {"video/mp4", Family::video, {{{4, "ftyp"sv}, {}}}},
            {"video/webm", Family::video, {{{0, "\x1a\x45\xdf\xa3"sv}, {}}}},
            {"video/ogg", Family::video, {{{0, "OggS"sv}, {}}}},
    }};

    bool matches(const Run& run, std::span<const std::byte> bytes) {
        if (run.at + run.bytes.size() > bytes.size())
            return false;
        for (std::size_t i = 0; i < run.bytes.size(); i++)
            if (bytes[run.at + i] != static_cast<std::byte>(run.bytes[i]))
                return false;
        return true;
    }

    /// `Image/JPEG; charset=binary` -> `image/jpeg`: a declared type is compared by its essence.
    std::string essence(std::string_view type) {
        type = type.substr(0, type.find(';'));
        constexpr std::string_view space = " \t\r\n\f\v";
        const auto first = type.find_first_not_of(space);
        if (first == std::string_view::npos)
            return {};
        type = type.substr(first, type.find_last_not_of(space) - first + 1);
        std::string out{type};
        for (char& c : out)
            if (c >= 'A' && c <= 'Z')
                c = static_cast<char>(c - 'A' + 'a');
        return out;
    }

}  // namespace

std::string_view media_url_kind_name(MediaUrlKind kind) {
    switch (kind) {
        case MediaUrlKind::attachment: return "attachment";
        case MediaUrlKind::thumbhash: return "thumbhash";
        case MediaUrlKind::thumbnail: return "thumbnail";
        case MediaUrlKind::staged: return "staged";
    }
    return "<INVALID>";
}

bool is_staged_path(std::string_view path) {
    if (path.empty() || path.size() > MAX_STAGED_PATH_BYTES ||
        path.find('\0') != std::string_view::npos || !valid_utf8(path))
        return false;
    // Either slash separates on Windows, so `/\host` is as much a share as `\\host`.
    const auto separator = [](char c) { return c == '/' || c == '\\'; };
    const bool posix = path[0] == '/' && !(path.size() >= 2 && separator(path[1]));
    const bool drive = path.size() >= 3 &&
                       ((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) &&
                       path[1] == ':' && (path[2] == '\\' || path[2] == '/');
    if (!posix && !drive)
        return false;
    std::size_t start = 0;
    while (start <= path.size()) {
        auto end = path.find_first_of("/\\", start);
        if (end == std::string_view::npos)
            end = path.size();
        const auto part = path.substr(start, end - start);
        if (part == "." || part == "..")
            return false;
        start = end + 1;
    }
    return true;
}

std::optional<MediaUrl> parse_media_url(std::string_view url) {
    std::string_view rest = url;
    if (!take(rest, SCHEME))
        return std::nullopt;

    if (take(rest, "staged/")) {
        for (const char c : rest)
            if (!unreserved(static_cast<unsigned char>(c)) && c != '%')
                return std::nullopt;
        auto path = parse_staged(rest);
        if (!path)
            return std::nullopt;
        return MediaUrl{MediaUrlKind::staged, 0, 0, *std::move(path)};
    }

    MediaUrlKind kind;
    if (take(rest, "attachment/"))
        kind = MediaUrlKind::attachment;
    else if (take(rest, "thumbhash/"))
        kind = MediaUrlKind::thumbhash;
    else if (take(rest, "thumbnail/"))
        kind = MediaUrlKind::thumbnail;
    else
        return std::nullopt;

    const auto message_id = take_id(rest);
    if (!message_id || *message_id == 0 || !take(rest, "/"))
        return std::nullopt;
    const auto index = take_id(rest);
    if (!index || !rest.empty())
        return std::nullopt;

    return MediaUrl{kind, static_cast<double>(*message_id), static_cast<double>(*index), {}};
}

std::optional<std::string> servable_content_type(
        std::string_view declared, std::span<const std::byte> bytes) {
    const std::string type = essence(declared);
    const Viewable* viewable = nullptr;
    for (const auto& each : VIEWABLE)
        if (each.type == type)
            viewable = &each;
    if (!viewable)
        return std::nullopt;

    for (const auto& signature : SIGNATURES) {
        if (!matches(signature.runs[0], bytes) || !matches(signature.runs[1], bytes))
            continue;
        if (signature.family != viewable->family)
            return std::nullopt;
        return std::string{signature.type};
    }
    return std::nullopt;
}

std::optional<std::string> servable_image_type(
        std::string_view declared, std::span<const std::byte> bytes) {
    auto type = servable_content_type(declared, bytes);
    if (!type || !type->starts_with("image/"))
        return std::nullopt;
    return type;
}

}  // namespace session_bridge
