/**
 * How wide a bubble may get, as a share of its container rather than a flat width.
 *
 * A flat width is a different proportion on every phone, which is what a proportional rule exists
 * to avoid. 75% sits between what the two clients do; the floor and cap are Android's.
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
