/**
 * Edges named for the reading direction rather than for a side.
 *
 * `start` is where a line begins and `end` where it finishes: left and right respectively in
 * English, the other way round in Arabic.
 *
 * Pixels or a percentage, never tokens: these reach the platform as raw style, where tamagui
 * resolves nothing, so a `$` name is silently dropped. Read a rung's number from the scale.
 */
export type LogicalLength = number | `${number}%`

export interface LogicalEdges {
  marginStart?: LogicalLength
  marginEnd?: LogicalLength
  paddingStart?: LogicalLength
  paddingEnd?: LogicalLength
  /** Absolute positioning: distance from the leading edge of the containing block. */
  insetStart?: LogicalLength
  /** Absolute positioning: distance from the trailing edge of the containing block. */
  insetEnd?: LogicalLength
  /** A rule down the leading edge: a toast's accent strip, which mirrors with the text. */
  borderStartWidth?: number
  /** A colour the platform can draw, from `useTokenColor` -- never a `$` name. */
  borderStartColor?: string
  /**
   * A rule down the trailing edge: the divider between two panes, which mirrors with them. Pixels
   * only: neither CSS nor react-native has a percentage border width.
   */
  borderEndWidth?: number
  /** From `useTokenColor`, never a `$` name, for the same reason as the lengths. */
  borderEndColor?: string
}
