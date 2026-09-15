import type { StepTransitionProps } from './StepTransition.types'

export type { StepTransitionProps }

/**
 * Nothing, on the web.
 *
 * The desktop client crosses between registration stages with a fade, which the onboarding frame
 * already does for itself; a horizontal push is a mobile idiom and putting one in an Electron
 * window would look like a phone app. Here so that shared code can wrap every step without asking
 * which platform it is on.
 */
export function StepTransition({ children }: StepTransitionProps) {
  return <>{children}</>
}
