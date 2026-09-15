/**
 * The tab bar's measurements, shared by both flavours so they cannot drift apart.
 *
 * The legacy client's own: 48 tall with a hairline under the whole bar, and the chosen tab marked
 * by a thick bar along its bottom edge rather than by a change of colour -- 5 points of the accent,
 * inset a little at each end (`verySmallSpacing`) so it reads as belonging to the tab rather than
 * as a continuation of the hairline.
 */
export const BAR_HEIGHT = 48
export const INDICATOR_HEIGHT = 5
export const INDICATOR_INSET = 4

/**
 * How long the indicator takes to slide.
 *
 * Android slides it rather than moving it, and the pages slide with it. Matched to the pager's own
 * timing: the two are one movement and any difference between them reads as a lag in whichever is
 * slower.
 */
export const SLIDE_MS = 250
