/**
 * How wide the artwork panel and the column beside it are.
 *
 * Three numbers rather than a function: `OnboardingChrome` hands them to Yoga as a flex basis, a
 * maximum and the sibling's minimum, which is the same rule expressed where the frame is actually
 * known. It used to be `min(width x 0.4, width - COLUMN_RESERVE, HERO_MAX_WIDTH)` over a window
 * snapshot, and a snapshot lags the frame it describes while that frame is being animated.
 */

/** The desktop client's registration column. Everything inside onboarding is this wide. */
export const COLUMN_WIDTH = 348

/**
 * The hero's share of the window.
 *
 * The desktop client's number, and it is the same in both orientations. A portrait tablet was
 * given more for a while, on the reading that 40% of it showed too little of the picture -- but
 * most of what was wrong there was a native sizing bug in the artwork itself, and once that was
 * fixed the wider panel was only taking space from the column. The content is the point on this
 * screen and it should breathe; the artwork is decoration. A product call.
 *
 * Worth knowing when reading the numbers: the artwork is cropped **horizontally**, not vertically.
 * It is drawn at the full height of its panel and its width follows from that, so the panel's
 * width alone decides how much of the picture is visible and nothing is ever lost above or below.
 */
export const HERO_GROW = 2

/** The column's share of the same five parts. */
export const COLUMN_GROW = 3

/**
 * The same split as a fraction, for the arithmetic.
 *
 * **Two grow factors against a zero basis rather than a `40%` basis, and the difference is not
 * cosmetic.** A percentage basis is resolved against the parent's main size and then cached, and
 * on native a parent that merely changed width does not dirty it -- so through a whole drag-resize
 * the panel kept the width it had when the drag began, while the column beside it, growing into
 * whatever was left, absorbed every point of the difference. The row still filled the window, so
 * nothing looked broken until the step changed and the subtree was laid out afresh, at which point
 * the panel snapped to its real share and the content beside it moved. That is the jump.
 *
 * Measured on an iPad: dragging 1101 -> 1145 held the panel at 377, which is 40% of 941, the width
 * the drag started from; dragging 907 -> 865 held it at 461, which is 40% of 1151. 130 of 140
 * samples were stale in this way. Free space distributed by grow factors is recomputed from the
 * container's current size on every pass and has nowhere to go stale.
 */
export const HERO_FRACTION = HERO_GROW / (HERO_GROW + COLUMN_GROW)

/**
 * The widest the artwork is allowed to get. A maximum, not a fixed split: on a very wide window
 * 40% of it is more picture than anyone needs.
 */
export const HERO_MAX_WIDTH = 640

/**
 * What the column needs, and what the hero may therefore not take.
 *
 * The column is a fixed width by design, so it cannot absorb a hero that grew: past this the
 * heading and the buttons start being squeezed, which is a worse trade than a tighter crop. It
 * binds on a narrow window rather than on a tablet, which is why it is a floor on the column
 * rather than a cap on the hero: the hero is the one with somewhere to give.
 */
export const COLUMN_RESERVE = COLUMN_WIDTH + 50
