import { useAccount, useHydrated, useStartupError } from '@session/state'
import { useState, type ReactNode } from 'react'

import { ConversationListScreen } from '../ConversationListScreen'
import { OnboardingFlow } from '../onboarding/OnboardingFlow'
import { StartingScreen } from '../StartingScreen'
import { StartupFailedScreen } from '../StartupFailedScreen'
import { usePersistedLocale } from '../usePersistedLocale'
import { AdaptiveShell } from './AdaptiveShell'

/**
 * Everything the app draws once its store exists: the startup failure, the launch screen,
 * onboarding, or the conversation list with the routed screen beside it.
 *
 * Each app hands over what its own router matched as `detail` and says whether that is anything
 * but the list, because reading a route is the app's business and never a screen's. Which of one
 * pane or two that becomes is `AdaptiveShell`'s decision, so a phone, a tablet and the desktop
 * window all go through here.
 */
export function SessionShell({
  detail,
  hasDetail,
  placeholder,
}: {
  detail: ReactNode
  hasDetail: boolean
  /** The second pane, before anything is open in it. */
  placeholder: ReactNode
}) {
  const hydrated = useHydrated()
  const startupError = useStartupError()
  const account = useAccount()
  const [onboarding, setOnboarding] = useState(false)
  // Here rather than at the root, which creates the store provider and so cannot read from it.
  usePersistedLocale()

  // Asked before `hydrated`, because both are false when a start has failed and only one of them
  // says so. The other order leaves the launch screen up over a failure that is already known.
  if (startupError !== null) return <StartupFailedScreen error={startupError} />
  if (!hydrated) return <StartingScreen />

  // Onboarding takes the whole window rather than a pane: there is no list to sit beside it,
  // and there will not be one until it has minted an identity.
  // `|| onboarding` because an account appearing is not the same as onboarding being over: a
  // restore mints one the moment the phrase is accepted and still has a wait to sit through.
  if (account?.haveAccount !== true || onboarding)
    return <OnboardingFlow onRunningChange={setOnboarding} />

  return (
    <AdaptiveShell
      list={<ConversationListScreen />}
      detail={detail}
      // Any route but the list has something to show in the detail pane, not just a
      // conversation: requests and settings are detail routes too, and keying this on the
      // conversation alone left them rendering the placeholder instead of the screen.
      hasDetail={hasDetail}
      placeholder={placeholder}
    />
  )
}
