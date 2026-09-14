/** How wide the artwork panel and the column beside it are, for a window of a given shape. */

/** The desktop client's registration column. Everything inside onboarding is this wide. */
export const COLUMN_WIDTH = 348

/**
 * The hero's share of the window, which is not one number.
 *
 * **The artwork is cropped horizontally, not vertically**: it is drawn at the full height of its
 * panel and its width follows from that, so the panel's width decides how much of the picture is
 * visible and nothing is ever lost above or below. The desktop client's 40% shows about
 * three-quarters of it, because a desktop window is wider than it is tall.
 *
 * A tablet held in portrait is not, and 40% of it left a sliver -- about a third of the picture --
 * which reads as a photograph enlarged rather than as artwork. Portrait therefore takes a larger
 * share. Landscape keeps the client's number, so the two designs agree wherever they can.
 */
const HERO_FRACTION_LANDSCAPE = 0.4
const HERO_FRACTION_PORTRAIT = 0.55

/**
 * The widest the artwork is allowed to get. A maximum, not a fixed split: on a very wide window
 * 40% of it is more picture than anyone needs.
 */
const HERO_MAX_WIDTH = 640

/**
 * What the column needs, and what the hero may therefore not take.
 *
 * The column is a fixed width by design, so it cannot absorb a hero that grew: past this the
 * heading and the buttons start being squeezed, which is a worse trade than a tighter crop. This
 * is what stops portrait going wider than it does.
 */
const COLUMN_RESERVE = COLUMN_WIDTH + 50

/** How wide the artwork's panel should be in a window this shape. */
export function heroWidth(window: { width: number; height: number }): number {
  const share = window.height > window.width ? HERO_FRACTION_PORTRAIT : HERO_FRACTION_LANDSCAPE
  return Math.min(window.width * share, window.width - COLUMN_RESERVE, HERO_MAX_WIDTH)
}
