export interface LandingHighlightProps {
  /**
   * Changes once per jump that lands on this message, and each new value plays the highlight again.
   * Absent: never landed on.
   */
  serial?: number | undefined
  /** Drawn at full strength and held: a picture of the landing, for the catalog. */
  still?: boolean | undefined
  /**
   * Round a bubble you sent, whose fill is the accent: the ring is then the text colour, as iOS
   * draws its glow in a light theme, since an accent glow is lost against an accent bubble.
   */
  outgoing: boolean
  /** The frame's corner, which the ring follows from outside. */
  radiusPx: number
}
