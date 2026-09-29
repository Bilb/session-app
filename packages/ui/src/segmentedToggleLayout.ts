/** The inset round the segments and the seam between them. */
export const SEGMENT_PADDING = 2

/** Which of the two segments is selected, or -1 when `value` is neither. */
export function selectedSegment<V>(
  segments: readonly [{ value: V }, { value: V }],
  value: V,
): number {
  return segments.findIndex((segment) => segment.value === value)
}
