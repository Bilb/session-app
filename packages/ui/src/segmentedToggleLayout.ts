/** The inset round the segments and the seam between them. */
export const SEGMENT_PADDING = 2

/** Which of the two segments is selected, or -1 when `value` is neither. */
export function selectedSegment<V>(
  segments: readonly [{ value: V }, { value: V }],
  value: V,
): number {
  return segments.findIndex((segment) => segment.value === value)
}

/**
 * How far the whole control has to grow on each side to reach `target`, from the height a segment
 * is drawn at. Half the shortfall, as `hitSlop` applies to every side; zero where it is tall enough.
 */
export function toggleSlop(segmentHeight: number, target: number): number {
  return Math.max(0, (target - (segmentHeight + 2 * SEGMENT_PADDING)) / 2)
}
