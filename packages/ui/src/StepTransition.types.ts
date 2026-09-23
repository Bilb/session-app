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
  /**
   * What back does from the step on screen, or undefined where there is none.
   *
   * On the phones this is also what the platform's own back gesture does, so a swipe can never
   * leave a step whose button would refuse. The web draws no stack and ignores it.
   */
  onBack?: (() => void) | undefined
  children: ReactNode
}
