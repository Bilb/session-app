import { flag } from '@session/app'
import { useMedia } from '@session/ui'

import { PhoneChrome } from './PhoneChrome'
import { WideChrome } from './WideChrome'
import { useFadeIn } from './chromeMetrics'
import type { ChromeProps } from './chromeProps'

export { EXTRA_ACTION_INSET, useStepPadding } from './chromeMetrics'

/**
 * The frame every onboarding screen sits in, and the thing that differs most between the designs.
 *
 * **Desktop**: artwork down the left, and to the right of it a fixed-width column carrying the
 * Session lockup, the help links, and then the step. The lockup and the links are above *every*
 * step rather than only the first, which is how the desktop client arranges it -- they belong to
 * onboarding rather than to the landing screen.
 *
 * **Phone**: no artwork, no lockup, the step filling the screen.
 *
 * Keyed on width rather than platform, because a tablet in landscape takes the desktop design.
 */
export function OnboardingChrome(props: ChromeProps) {
  const wide = useMedia().gtSm
  // Fades the content in when the step changes. `testID` is the step's identity, so a new step
  // remounts this and the animation runs; the artwork and the lockup sit outside it and do not.
  // Desktop only: the mobile clients cut between steps, and an opacity with nothing interpolating
  // it is a frame of invisible content rather than a transition. Read here rather than inside the
  // wide layout so the hook runs on both paths and the rules of hooks are not a thing either
  // layout has to think about.
  const fading = useFadeIn(props.testID, flag('disableAnimations'))

  return wide ? (
    <WideChrome testID={props.testID} banner={props.banner} fading={fading}>
      {props.children}
    </WideChrome>
  ) : (
    <PhoneChrome {...props} />
  )
}
