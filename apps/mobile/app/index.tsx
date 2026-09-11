import { ConversationListScreen, OnboardingFlow, StartingScreen } from '@session/screens'
import { useAccount, useHydrated } from '@session/state'

/**
 * The list, or onboarding when there is no account to list anything for.
 *
 * Chosen here rather than by navigating, because there is nothing to navigate back to: until an
 * identity exists the app has exactly one screen, and a redirect would put an empty list in the
 * history behind it.
 *
 * Nothing is chosen until the first state arrives. Drawing the list while `hydrated` is still
 * false shows a new account an empty conversation list for as long as the database takes to
 * answer, and then replaces it with onboarding.
 *
 * On a phone the list is the whole screen and a conversation pushes over it; on a tablet
 * AdaptiveShell keeps it beside the detail. Neither is decided here.
 */
export default function IndexRoute() {
  const hydrated = useHydrated()
  const account = useAccount()

  if (!hydrated) return <StartingScreen />
  if (account?.haveAccount !== true) return <OnboardingFlow />
  return <ConversationListScreen />
}
