/**
 * How wide a bubble is allowed to get, as **Android's rule against the box it is actually in**.
 *
 * Both clients inset this conversation by 36 either side, and Android then takes a share of what
 * is left: `min(500, max(200, available x 0.8))`, measured on the padded container rather than on
 * the screen. iOS instead caps at a flat 230 -- which is not a share at all, and reads as one only
 * by accident: against its own container that number is 93% on an iPhone SE and 62% on a 16 Pro
 * Max. A bubble that is nearly the full width on a small phone and barely half of it on a large
 * one is the thing a proportional rule exists to avoid.
 *
 * **The share is 75%, between the two.** Android's 80% is the wider end and iOS's flat number the
 * narrower; 75 sits between them at every size. A product call.
 *
 * At that share the floor earns its place, which it does not at Android's: an SE's container is
 * 250, and three quarters of it is 188 -- narrower than either client draws. So both ends are
 * kept.
 */
const BUBBLE_SHARE = 0.75
export const BUBBLE_MIN_WIDTH = 200
const BUBBLE_MAX_WIDTH = 500

/**
 * The widest a bubble may be in a container this wide.
 *
 * Takes the container's measured width rather than the window's, which is what Android's own
 * `BoxWithConstraints` does. The distinction matters on a tablet, where the conversation sits in a
 * fixed column that is nothing like the width of the screen -- and during a rotation, where a
 * number derived from the window lags the box it is meant to describe.
 */
export function bubbleMaxWidth(available: number): number {
  return Math.min(BUBBLE_MAX_WIDTH, Math.max(BUBBLE_MIN_WIDTH, available * BUBBLE_SHARE))
}
