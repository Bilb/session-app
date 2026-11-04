import type { ReactNode } from 'react'

/** One turn a second: quick enough to read as working, slow enough not to read as alarm. */
export const RING_TURN_MS = 1000

/** The turning layer alone: the ring places it over its track. */
export interface RingSpinProps {
  /** The layer's side, in px: the ring's. It turns about its centre. */
  size: number
  /** Held at its starting angle rather than turning: the ring has been asked for no motion. */
  still: boolean
  children: ReactNode
}
