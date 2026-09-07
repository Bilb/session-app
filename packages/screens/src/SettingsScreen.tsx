import { tr } from '@session/localization'
import { useAccount } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Screen, Separator, Text, XStack, YStack } from '@session/ui'

import { requirePorts } from '@session/app'

import { BackButton } from './BackButton'

/**
 * Settings, which for now is the account.
 *
 * The account ID is here because it is the one piece of state a person has to be able to read
 * off the screen: it is what someone else needs in order to write to this device, and until
 * onboarding grows a QR code it is the only way to hand it over.
 */
export function SettingsScreen() {
  const account = useAccount()

  return (
    <Screen padded testID={ELEMENT.settings.screen}>
      <XStack alignItems="center" gap="$1.5">
        <BackButton testID={ELEMENT.settings.back} />
        <Text size="$6" weight="bold">
          {tr('sessionSettings')}
        </Text>
      </XStack>

      <YStack paddingVertical="$2" gap="$0.5">
        <Text tone="secondary" size="$2">
          {tr('accountId')}
        </Text>
        <XStack alignItems="center" gap="$1">
          <Text
            testID={ELEMENT.settings.accountId}
            // Wraps rather than truncates: a session ID that is cut off is not one you can
            // read out to somebody, which is the only reason it is on screen.
            flex={1}
          >
            {account?.sessionId ?? 'No account yet'}
          </Text>
        </XStack>
        {account?.sessionId === undefined ? null : (
          <Text
            tone="accent"
            size="$2"
            onPress={() => {
              void requirePorts().clipboard.setString(account.sessionId ?? '')
            }}
          >
            {tr('copy')}
          </Text>
        )}
      </YStack>

      <Separator borderColor="$bordersColor" />

      <YStack paddingVertical="$2" gap="$0.5">
        <Text tone="secondary" size="$2">
          Network
        </Text>
        <Text testID={ELEMENT.settings.networkStatus}>
          {account?.networkAttached === true ? 'Attached' : 'Not attached'}
        </Text>
      </YStack>
    </Screen>
  )
}
