import type { ReactNode } from 'react'

export interface StepTransitionProps {
  /**
   * The steps back leads through, oldest first; the last is the one on screen.
   *
   * The path back rather than the history, so the screen a back swipe uncovers is the one back
   * goes to. A change to the last entry is what starts a transition: a push when it is new to the
   * stack, a pop when it was already below. Two renders of the same step -- a button going busy,
   * an error appearing -- must not look like a navigation, so these are the steps' identities.
   */
  path: readonly string[]
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
