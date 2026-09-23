/**
 * Edges named for the reading direction rather than for a side.
 *
 * `start` is where a line begins and `end` where it finishes: left and right respectively in
 * English, the other way round in Arabic.
 *
 * A number is pixels and a string is whatever CSS or react-native would make of it, which in
 * practice means a percentage -- the tab indicator is placed by its share of the bar. Not tokens:
 * the platforms disagree about what one means here and neither takes one for an inset.
 */
export type LogicalLength = number | string

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
  borderEndColor?: string
}
