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
export const HERO_BASIS = '40%'

/** The same number, for the arithmetic that cannot be done with a percentage. */
export const HERO_FRACTION = Number.parseFloat(HERO_BASIS) / 100

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
