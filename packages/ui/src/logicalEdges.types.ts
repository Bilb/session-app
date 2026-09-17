/**
 * Edges named for the reading direction rather than for a side.
 *
 * `start` is where a line begins and `end` where it finishes: left and right respectively in
 * English, the other way round in Arabic. Numbers only, because these are pixel offsets rather
 * than tokens — the platforms disagree about what a token means here and neither accepts one for
 * an inset.
 */
export interface LogicalEdges {
  marginStart?: number
  marginEnd?: number
  paddingStart?: number
  paddingEnd?: number
  /** Absolute positioning: distance from the leading edge of the containing block. */
  insetStart?: number
  /** Absolute positioning: distance from the trailing edge of the containing block. */
  insetEnd?: number
}
