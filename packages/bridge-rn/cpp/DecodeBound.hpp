#pragma once

#include <algorithm>
#include <cmath>

// How large the iOS image loader lets ImageIO decode a picture. Kept free of CoreGraphics so the
// host tests can hold it.
namespace session_bridge_rn {

/// A decode's ceiling in pixels, whatever the view asks for: the largest iPad screen, 2752x2064,
/// fits whole, and at 4 bytes a pixel no decode passes 24 MiB.
inline constexpr double DECODE_PIXEL_BUDGET = 3072.0 * 2048.0;

/// Whether a picture of `width` by `height` pixels may be decoded at full size.
inline bool fits_decode_budget(double width, double height) {
    return width > 0 && height > 0 && width * height <= DECODE_PIXEL_BUDGET;
}

/// The longest edge a decode may have for a view of `longest` device pixels, or for any view when
/// `longest` is zero, of a picture whose header says `width` by `height`, or zero when it does not.
///
/// The fit never reaches a loader (Fabric asks with stretch for every request), so this assumes
/// `cover`: the picture's shorter edge spans the view, and its longer edge overshoots by the aspect
/// ratio. Never past the file's own size, so nothing is upsized, and never past an area of
/// `DECODE_PIXEL_BUDGET`, which the overshoot of a long thin picture would otherwise reach.
inline double decode_edge_bound(double longest, double width, double height) {
    if (!(width > 0 && height > 0)) {
        // With the aspect unknown, a square is the largest area an edge can span.
        const double square = std::floor(std::sqrt(DECODE_PIXEL_BUDGET));
        return longest > 0 ? std::min(longest, square) : square;
    }
    const double aspect = std::max(width / height, height / width);
    // A longest edge L leaves a shorter one of L / aspect, so the area is L^2 / aspect.
    double bound =
            std::min(std::max(width, height), std::floor(std::sqrt(DECODE_PIXEL_BUDGET * aspect)));
    if (longest > 0)
        bound = std::min(bound, std::ceil(longest * aspect));
    return bound;
}

}  // namespace session_bridge_rn
