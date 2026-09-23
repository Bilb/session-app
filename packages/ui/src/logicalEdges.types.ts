/**
 * Edges named for the reading direction rather than for a side.
 *
 * `start` is where a line begins and `end` where it finishes: left and right respectively in
 * English, the other way round in Arabic.
 *
 * Pixels, or a percentage -- the tab indicator is placed by its share of the bar. **Not tokens**:
 * these reach the platform as raw style, where tamagui resolves nothing, so a `$` name is dropped
 * without complaint. A caller with a rung in mind reads its number from the scale.
 */
type LogicalLength = number | `${number}%`

export interface LogicalEdges {
  marginStart?: LogicalLength
  marginEnd?: LogicalLength
  paddingStart?: LogicalLength
  paddingEnd?: LogicalLength
  /** Absolute positioning: distance from the leading edge of the containing block. */
  insetStart?: LogicalLength
  /** Absolute positioning: distance from the trailing edge of the containing block. */
  insetEnd?: LogicalLength
  /** A rule down the trailing edge: the divider between two panes, which mirrors with them. */
  borderEndWidth?: LogicalLength
  /** A colour the platform can draw, from `useTokenColor` -- never a `$` name. See the lengths. */
  borderEndColor?: string
}
