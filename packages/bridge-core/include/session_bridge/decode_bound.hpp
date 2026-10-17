#pragma once

#include <algorithm>
#include <cmath>
#include <string_view>

// How large an image loader may decode an original or a rendition, which only the viewer draws, and
// a thumbnail. Free of libsession and of any platform's headers, so the host tests can hold it.
namespace session_bridge {

/// A decode's ceiling in pixels: the largest iPad screen, 2752x2064, fits whole, and at 4 bytes a
/// pixel no decode passes 24 MiB.
inline constexpr double DECODE_PIXEL_BUDGET = 3072.0 * 2048.0;

/// Whether a picture of `width` by `height` pixels may be decoded at full size.
inline bool fits_decode_budget(double width, double height) {
    return width > 0 && height > 0 && width * height <= DECODE_PIXEL_BUDGET;
}

/// The longest edge a decode may have of a picture whose header says `width` by `height`, or zero
/// when it does not: never past the file's own size, so nothing is upsized, and never past an area
/// of `DECODE_PIXEL_BUDGET`.
inline double decode_edge_bound(double width, double height) {
    if (!(width > 0 && height > 0))
        // With the aspect unknown, a square is the largest area an edge can span.
        return std::floor(std::sqrt(DECODE_PIXEL_BUDGET));
    const double aspect = std::max(width / height, height / width);
    // A longest edge L leaves a shorter one of L / aspect, so the area is L^2 / aspect.
    return std::min(std::max(width, height), std::floor(std::sqrt(DECODE_PIXEL_BUDGET * aspect)));
}

/// The largest GIF or PNG area a loader hands its decoder, since ImageIO decodes both whole before
/// it reduces them: twice a 48 MP camera frame saved as PNG, and 400 MB at 4 bytes a pixel.
inline constexpr double WHOLE_DECODE_PIXEL_CEILING = 100'000'000.0;

/// Whether a picture of `type` whose header says `width` by `height` is too large to decode, given
/// that ImageIO holds a GIF or PNG at full size first. An unknown size refuses nothing.
inline bool exceeds_whole_decode_ceiling(std::string_view type, double width, double height) {
    if (type != "image/gif" && type != "image/png")
        return false;
    return width > 0 && height > 0 && width * height > WHOLE_DECODE_PIXEL_CEILING;
}

/// How to draw an original or a rendition, from its header: what every platform's loader applies.
struct DecodePlan {
    /// The longest edge to decode at, or zero to decode it whole.
    double edge;
    /// Whether an animation is to be drawn as its first frame alone.
    bool first_frame_only;
    /// Whether it is too large to decode at all, and is to draw as failed.
    bool refused;
    /// Whether its size was read. One that was not is planned as the largest square the budget
    /// allows, drawn still.
    bool measured;
};

/// The plan for a picture whose size could not be read.
inline DecodePlan unmeasured_decode_plan() {
    return {decode_edge_bound(0, 0), true, false, false};
}

/// The plan for a picture of `type` whose header says `width` by `height` and `frames` frames.
///
/// An animation animates only while its canvas fits the budget. Its frames are decoded one at a
/// time as they are drawn, so the canvas, not the canvas times the frames, is what one costs.
inline DecodePlan decode_plan(std::string_view type, double width, double height, double frames) {
    if (!(width > 0 && height > 0))
        return unmeasured_decode_plan();
    const bool fits = fits_decode_budget(width, height);
    return {fits ? 0 : decode_edge_bound(width, height),
            !fits && frames > 1,
            exceeds_whole_decode_ceiling(type, width, height),
            true};
}

/// The longest edge to decode a `width` by `height` thumbnail at, to fill a `view_width` by
/// `view_height` pixel box under a `cover` fit, or zero to decode it whole. Reduced only when the
/// view needs half of it or less: of an album's tiles, only a single one and a three-up's lead
/// decode whole.
inline double thumbnail_decode_edge(
        double width, double height, double view_width, double view_height) {
    if (!(width > 0 && height > 0 && view_width > 0 && view_height > 0))
        return 0;
    const double cover = std::max(view_width / width, view_height / height);
    if (cover > 0.5)
        return 0;
    return std::ceil(cover * std::max(width, height));
}

}  // namespace session_bridge
