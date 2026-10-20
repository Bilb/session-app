/** The smallest a fitted line goes, as a share of its size, before it truncates instead. */
const MIN_FIT_SCALE = 0.5

/**
 * The font size that fits a line of `contentWidth` into `boxWidth`, or null when it already fits.
 * Never below `MIN_FIT_SCALE` of the full size: past that the line truncates.
 */
export function fittedFontSize(
  fullSize: number,
  boxWidth: number,
  contentWidth: number,
): number | null {
  if (boxWidth <= 0 || contentWidth <= boxWidth) return null
  return fullSize * Math.max(MIN_FIT_SCALE, boxWidth / contentWidth)
}
