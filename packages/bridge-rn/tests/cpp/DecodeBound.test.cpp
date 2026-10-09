// The iOS image loader's decode bound, which the loader itself cannot be run here to check.

#include "DecodeBound.hpp"

#include <algorithm>
#include <cstdio>
#include <cstdlib>

using session_bridge_rn::decode_edge_bound;
using session_bridge_rn::DECODE_PIXEL_BUDGET;
using session_bridge_rn::fits_decode_budget;

namespace {

int failures = 0;

#define CHECK(condition)                                                                       \
    do {                                                                                       \
        if (!(condition)) {                                                                    \
            std::fprintf(stderr, "%s:%d: CHECK failed: %s\n", __FILE__, __LINE__, #condition); \
            failures++;                                                                        \
        }                                                                                      \
    } while (0)

/// The pixels a decode of a `width` by `height` picture holds when its longest edge is `bound`.
double decoded_area(double bound, double width, double height) {
    const double longest = std::max(width, height), shortest = std::min(width, height);
    const double edge = std::min(bound, longest);
    return edge * (edge * shortest / longest);
}

void a_long_thin_picture_stays_within_the_budget() {
    // A 720 px tile on a 3x device, and a viewer's longest edge.
    for (const double view : {720.0, 2796.0, 0.0}) {
        CHECK(decoded_area(decode_edge_bound(view, 65535, 655), 65535, 655) <= DECODE_PIXEL_BUDGET);
        CHECK(decoded_area(decode_edge_bound(view, 1000, 100000), 1000, 100000)
              <= DECODE_PIXEL_BUDGET);
        CHECK(decoded_area(decode_edge_bound(view, 16384, 16384), 16384, 16384)
              <= DECODE_PIXEL_BUDGET);
    }
}

void an_ordinary_picture_keeps_its_cover_overshoot() {
    // A 4:3 photo in a 720 px tile: the shorter edge spans the tile.
    CHECK(decode_edge_bound(720, 4032, 3024) == 960);
    // A phone screenshot in the same tile.
    CHECK(decode_edge_bound(720, 1179, 2556) == 1561);
    // A 4:3 photo full screen on the largest iPad still decodes larger than the screen.
    CHECK(decode_edge_bound(2752, 4032, 3024) >= 2752);
}

void nothing_is_upsized() {
    CHECK(decode_edge_bound(720, 300, 200) == 300);
    CHECK(decode_edge_bound(0, 300, 200) == 300);
}

void an_unknown_size_is_bounded_as_a_square() {
    CHECK(decode_edge_bound(720, 0, 0) == 720);
    const double square = decode_edge_bound(0, 0, 0);
    CHECK(square > 0 && square * square <= DECODE_PIXEL_BUDGET);
}

void the_largest_screen_fits_and_a_huge_canvas_does_not() {
    CHECK(fits_decode_budget(2752, 2064));
    CHECK(!fits_decode_budget(16384, 16384));
    CHECK(!fits_decode_budget(65535, 655));
    CHECK(!fits_decode_budget(0, 0));
    CHECK(!fits_decode_budget(-1, 100));
}

}  // namespace

int main() {
    a_long_thin_picture_stays_within_the_budget();
    an_ordinary_picture_keeps_its_cover_overshoot();
    nothing_is_upsized();
    an_unknown_size_is_bounded_as_a_square();
    the_largest_screen_fits_and_a_huge_canvas_does_not();
    if (failures == 0)
        std::puts("DecodeBound: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
