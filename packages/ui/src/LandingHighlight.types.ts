export interface LandingHighlightProps {
  /**
   * Changes once per jump that lands on this message, and each new value plays the highlight again.
   * Absent: never landed on.
   */
  serial?: number | undefined
  /** Drawn at full strength and held: a picture of the landing, for the catalog. */
  still?: boolean | undefined
  /** The frame's corner, which the ring follows from outside. */
  radiusPx: number
}
