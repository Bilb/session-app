import type { ReactNode } from 'react'

/** The fade alone: the indicator places each layer, centred over the others. */
export interface UpdateFadeLayerProps {
  /** Fading out: a layer mounted for the state being left. */
  leaving: boolean
  /** At its end state at once, with no fade. */
  instant: boolean
  children: ReactNode
}
