/**
 * How wide a bubble is allowed to get, as **Android's rule against the box it is actually in**.
 *
 * Both clients inset this conversation by 36 either side. Android then takes a share of what is
 * left -- `min(500, max(200, available x 0.8))` -- while iOS caps at a flat 230, which is 93% of
 * an iPhone SE's container and 62% of a 16 Pro Max's. A bubble that is nearly full width on a
 * small phone and half of it on a large one is what a proportional rule exists to avoid.
 *
 * **The share is 75%, between the two**, and at that share the floor earns its place: an SE's
 * container is 250, and three quarters of it is narrower than either client draws.
 */
const BUBBLE_SHARE = 0.75
export const BUBBLE_MIN_WIDTH = 200
const BUBBLE_MAX_WIDTH = 500

/**
 * The widest a bubble may be in a container this wide.
 *
 * The container's measured width rather than the window's, as Android's `BoxWithConstraints`
 * does. It matters on a tablet, where the conversation sits in a fixed column nothing like the
 * width of the screen, and during a rotation, where a window-derived number lags the box.
 */
export function bubbleMaxWidth(available: number): number {
  return Math.min(BUBBLE_MAX_WIDTH, Math.max(BUBBLE_MIN_WIDTH, available * BUBBLE_SHARE))
}
