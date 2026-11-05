/** Android's distance, which feels right on a phone; iOS's 110 pt is a long way for a thumb. */
export const SWIPE_REPLY_THRESHOLD_PX = 64
/** Sideways travel before the swipe takes the touch, and the vertical travel that gives it up. */
export const SWIPE_ACTIVATE_PX = 10
export const SWIPE_FAIL_Y_PX = 10
/** How much of the travel past the threshold the row still follows. */
export const SWIPE_RESISTANCE = 0.25

/** How far the row is drawn for `toward` px of travel towards the leading edge. */
export function swipeDrawn(toward: number): number {
  'worklet'
  const travel = Math.max(0, toward)
  if (travel <= SWIPE_REPLY_THRESHOLD_PX) return travel
  return SWIPE_REPLY_THRESHOLD_PX + (travel - SWIPE_REPLY_THRESHOLD_PX) * SWIPE_RESISTANCE
}
