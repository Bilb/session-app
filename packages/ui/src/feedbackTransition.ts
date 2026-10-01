import { DURATION } from '@session/theme-tokens'

import type { FeedbackTransition } from './feedbackTransition.types'

// CSS rather than an `animation` prop: tamagui has no animation driver configured.
export const FEEDBACK_TRANSITION: FeedbackTransition = {
  transition: `opacity ${String(DURATION.default)}ms ease-out, background-color ${String(DURATION.default)}ms ease-out`,
}
