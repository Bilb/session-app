import { ELEMENT } from '@session/test-ids'
import { Screen, Text, YStack } from '@session/ui'

/** A placeholder screen. The route has to exist for the contract test to pass. */
export default function SettingsRoute() {
  return (
    <Screen testID={ELEMENT.settings.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Text tone="secondary">Settings</Text>
      </YStack>
    </Screen>
  )
}
