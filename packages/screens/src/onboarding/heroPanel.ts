/**
 * How wide the artwork panel and the column beside it are.
 *
 * Numbers handed to Yoga rather than a width computed in JS: grow factors and a maximum, which is
 * the same rule expressed where the frame is actually known. A width worked out in JS comes from a
 * window snapshot, and a snapshot lags the frame it describes while that frame is being animated.
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
 * **Two grow factors against a zero basis, and not a `40%` basis.** A percentage basis is resolved
 * against the parent's main size and then cached, and on native a parent that merely changes width
 * does not dirty it -- so through a drag-resize the panel holds the width it had when the drag
 * began, while the column beside it absorbs the difference and the row still fills the window.
 * Nothing looks wrong until the step changes and the subtree is laid out afresh. Free space shared
 * by grow factors is recomputed from the container's current size on every pass, so it has nowhere
 * to go stale.
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
