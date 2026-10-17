// The decode bounds the image loaders draw originals and thumbnails within, which the loaders
// themselves cannot be run here to check, and the plan against the table the fake's mirror of it
// is held to: `media_vectors.hpp` is written from `mediaVectors.ts` by `run.sh`.

#include <session_bridge/decode_bound.hpp>

#include "media_vectors.hpp"

#include <algorithm>
#include <cstdio>
#include <cstdlib>

using session_bridge::decode_edge_bound;
using session_bridge::decode_plan;
using session_bridge::DECODE_PIXEL_BUDGET;
using session_bridge::exceeds_whole_decode_ceiling;
using session_bridge::fits_decode_budget;
using session_bridge::thumbnail_decode_edge;

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
    CHECK(decoded_area(decode_edge_bound(65535, 655), 65535, 655) <= DECODE_PIXEL_BUDGET);
    CHECK(decoded_area(decode_edge_bound(1000, 100000), 1000, 100000) <= DECODE_PIXEL_BUDGET);
    CHECK(decoded_area(decode_edge_bound(16384, 16384), 16384, 16384) <= DECODE_PIXEL_BUDGET);
}

void a_picture_within_the_budget_decodes_at_its_own_size() {
    // A phone screenshot, and the largest iPad screen.
    CHECK(decode_edge_bound(1179, 2556) == 2556);
    CHECK(decode_edge_bound(2752, 2064) == 2752);
}

void a_12_megapixel_photo_is_reduced_to_the_budget() {
    const double bound = decode_edge_bound(4032, 3024);
    CHECK(bound < 4032 && bound >= 2752);
    CHECK(decoded_area(bound, 4032, 3024) <= DECODE_PIXEL_BUDGET);
}

void nothing_is_upsized() {
    CHECK(decode_edge_bound(300, 200) == 300);
}

void an_unknown_size_is_bounded_as_a_square() {
    const double square = decode_edge_bound(0, 0);
    CHECK(square > 0 && square * square <= DECODE_PIXEL_BUDGET);
}

void the_largest_screen_fits_and_a_huge_canvas_does_not() {
    CHECK(fits_decode_budget(2752, 2064));
    CHECK(!fits_decode_budget(16384, 16384));
    CHECK(!fits_decode_budget(65535, 655));
    CHECK(!fits_decode_budget(0, 0));
    CHECK(!fits_decode_budget(-1, 100));
}

void a_huge_gif_or_png_is_refused() {
    CHECK(exceeds_whole_decode_ceiling("image/gif", 16384, 16384));
    CHECK(exceeds_whole_decode_ceiling("image/png", 16384, 16384));
    CHECK(exceeds_whole_decode_ceiling("image/png", 65535, 2000));
}

void real_content_is_not() {
    // A 48 MP camera frame saved as PNG, and a long scrolling screenshot.
    CHECK(!exceeds_whole_decode_ceiling("image/png", 8064, 6048));
    CHECK(!exceeds_whole_decode_ceiling("image/png", 1440, 30000));
    CHECK(!exceeds_whole_decode_ceiling("image/gif", 2752, 2064));
}

void only_whole_decoders_are_refused() {
    // ImageIO reduces a JPEG while decoding it, so its size is the decode bound's to handle.
    CHECK(!exceeds_whole_decode_ceiling("image/jpeg", 16384, 16384));
}

void an_unknown_size_is_not_refused() {
    CHECK(!exceeds_whole_decode_ceiling("image/png", 0, 0));
    CHECK(!exceeds_whole_decode_ceiling("image/gif", 0, 65535));
}

void a_file_row_glyph_decodes_a_thumbnail_at_its_own_size() {
    // A 40 pt glyph at 3x, from a 720 px thumbnail.
    CHECK(thumbnail_decode_edge(720, 720, 120, 120) == 120);
}

void a_tile_near_the_thumbnail_size_decodes_it_whole() {
    CHECK(thumbnail_decode_edge(720, 720, 720, 720) == 0);
    CHECK(thumbnail_decode_edge(720, 720, 400, 400) == 0);
    // Smaller than the view: never upsized.
    CHECK(thumbnail_decode_edge(240, 240, 720, 720) == 0);
}

void a_cover_fit_takes_the_view_edge_that_needs_more() {
    // A wide tile still has to cover its full width from a square thumbnail.
    CHECK(thumbnail_decode_edge(1024, 1024, 300, 100) == 300);
}

void an_unknown_view_decodes_the_thumbnail_whole() {
    CHECK(thumbnail_decode_edge(720, 720, 0, 0) == 0);
    CHECK(thumbnail_decode_edge(0, 0, 120, 120) == 0);
}

void plans_every_header_as_the_table_says() {
    for (const auto& vector : media_vectors::DECODE_PLANS) {
        const auto plan = decode_plan(vector.type, vector.width, vector.height);
        const bool same = plan.edge_px == vector.edge_px
                       && plan.first_frame_only == vector.first_frame_only
                       && plan.exceeds_whole_decode_ceiling == vector.exceeds_whole_decode_ceiling
                       && plan.measured == vector.measured;
        if (!same) {
            std::fprintf(
                    stderr,
                    "decode_plan: %.*s %gx%g: edge %g, first frame %d, past the ceiling %d, "
                    "measured %d\n",
                    static_cast<int>(vector.type.size()), vector.type.data(), vector.width,
                    vector.height, plan.edge_px, plan.first_frame_only,
                    plan.exceeds_whole_decode_ceiling, plan.measured);
            failures++;
        }
    }
}

void a_planned_decode_stays_within_the_budget() {
    for (const auto& vector : media_vectors::DECODE_PLANS) {
        const auto plan = decode_plan(vector.type, vector.width, vector.height);
        if (plan.measured && plan.edge_px > 0)
            CHECK(decoded_area(plan.edge_px, vector.width, vector.height) <= DECODE_PIXEL_BUDGET);
    }
}

void a_negative_or_unknown_size_is_unmeasured() {
    CHECK(!decode_plan("image/png", -1, 100).measured);
    CHECK(!decode_plan("image/gif", 0, 65535).measured);
    CHECK(!decode_plan("image/gif", 0, 65535).exceeds_whole_decode_ceiling);
}

}  // namespace

int main() {
    a_long_thin_picture_stays_within_the_budget();
    a_picture_within_the_budget_decodes_at_its_own_size();
    a_12_megapixel_photo_is_reduced_to_the_budget();
    nothing_is_upsized();
    an_unknown_size_is_bounded_as_a_square();
    the_largest_screen_fits_and_a_huge_canvas_does_not();
    a_huge_gif_or_png_is_refused();
    real_content_is_not();
    only_whole_decoders_are_refused();
    an_unknown_size_is_not_refused();
    a_file_row_glyph_decodes_a_thumbnail_at_its_own_size();
    a_tile_near_the_thumbnail_size_decodes_it_whole();
    a_cover_fit_takes_the_view_edge_that_needs_more();
    an_unknown_view_decodes_the_thumbnail_whole();
    plans_every_header_as_the_table_says();
    a_planned_decode_stays_within_the_budget();
    a_negative_or_unknown_size_is_unmeasured();
    if (failures == 0)
        std::puts("decode_bound: all passed");
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
