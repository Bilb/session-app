/**
 * The geometry of a two-member avatar, apart from the component so it can be asserted without a
 * renderer.
 *
 * The design draws it at 48: the second member a 32 disc in the top-start corner, the first a 34
 * disc in the bottom-end corner, ringed 2 wide in the page colour so the overlap reads as one disc
 * in front of another. Other sizes keep those proportions; the ring stays 2, because it is a
 * hairline gap rather than part of the picture.
 */
const DESIGN_SIZE_PX = 48
const BACK_DESIGN_PX = 32
const FRONT_DESIGN_PX = 34

const RING_PX = 2

interface AvatarPairLayout {
  /** The member drawn behind. */
  backPx: number
  /** The member drawn in front, ring included. */
  frontPx: number
  ringPx: number
}

export function avatarPairLayout(sizePx: number): AvatarPairLayout {
  return {
    backPx: Math.round((sizePx * BACK_DESIGN_PX) / DESIGN_SIZE_PX),
    frontPx: Math.round((sizePx * FRONT_DESIGN_PX) / DESIGN_SIZE_PX),
    ringPx: RING_PX,
  }
}
