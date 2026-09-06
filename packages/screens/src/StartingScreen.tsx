import { ELEMENT } from '@session/test-ids'
import { Screen, Text, YStack } from '@session/ui'

/**
 * What both apps show before the first state has arrived.
 *
 * Shared because the alternative is each app guessing while it waits, and the guesses differ:
 * anything drawn here is drawn without knowing whether there is an account, so a list or
 * onboarding would be a decision made on missing information and corrected a frame later.
 */
export function StartingScreen() {
  return (
    <Screen testID={ELEMENT.starting.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Text tone="secondary">Starting…</Text>
      </YStack>
    </Screen>
  )
}
