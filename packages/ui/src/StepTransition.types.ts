import type { ReactNode } from 'react'

export interface StepTransitionProps {
  /**
   * Which step is on screen. A change is what starts a transition.
   *
   * The step's identity rather than its content: two renders of the same step -- a button going
   * busy, an error appearing -- must not look like a navigation.
   */
  stepKey: string
  /** Which way the last move went, so the screens travel the way a stack would move them. */
  direction: 'forward' | 'back'
  /**
   * Cut rather than animate. See the `disableAnimations` flag: an automated run cannot tap a
   * control that is still sliding.
   */
  instant?: boolean
  children: ReactNode
}
