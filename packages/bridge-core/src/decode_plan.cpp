#include <session_bridge/decode_plan.hpp>

#include <session/image/probe.hpp>
#include <session/image/source.hpp>

#include <algorithm>
#include <exception>
#include <string_view>
#include <utility>

namespace session_bridge {

namespace {

    std::string_view content_type_of(::session::image::Format format) {
        using ::session::image::Format;
        switch (format) {
            case Format::jpeg: return "image/jpeg";
            case Format::png: return "image/png";
            case Format::webp: return "image/webp";
            case Format::gif: return "image/gif";
            case Format::heic: return "image/heic";
            case Format::avif: return "image/avif";
        }
        return {};
    }

    /// The logical screen size a GIF's header declares, which every decoder but libnsgif allocates.
    std::pair<double, double> gif_screen(std::span<const std::byte> bytes) {
        if (bytes.size() < 10)
            return {0, 0};
        auto u16 = [&](size_t at) {
            return double(std::to_integer<unsigned>(bytes[at]) |
                          std::to_integer<unsigned>(bytes[at + 1]) << 8);
        };
        return {u16(6), u16(8)};
    }

}  // namespace

DecodePlan decode_plan(std::span<const std::byte> bytes) {
    try {
        ::session::image::Source source{bytes};
        const auto info = ::session::image::probe(source);
        if (!info)
            return unmeasured_decode_plan();
        double width = info->width, height = info->height;
        // libnsgif takes a screen past 2048 for a bogus one and measures the frames instead.
        if (info->format == ::session::image::Format::gif) {
            const auto [screen_width, screen_height] = gif_screen(bytes);
            width = std::max(width, screen_width);
            height = std::max(height, screen_height);
        }
        return decode_plan(content_type_of(info->format), width, height);
    } catch (const std::exception&) {
        return unmeasured_decode_plan();
    }
}

}  // namespace session_bridge
