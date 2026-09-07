import { tr } from '@session/localization'
import { useAccount } from '@session/state'
import { useState } from 'react'
import { ELEMENT } from '@session/test-ids'
import { Button, Screen, Separator, Text, XStack, YStack } from '@session/ui'

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
  const [copied, setCopied] = useState(false)

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
        {/* A button rather than tappable text. The account ID is the one thing on this screen
            somebody has to get out of the app, and the old affordance was 11pt of text with no hit
            area to speak of and nothing to say it had worked. */}
        {account?.sessionId === undefined ? null : (
          <Button
            variant="outline"
            size="sm"
            testID={ELEMENT.settings.copyAccountId}
            onPress={() => {
              const id = account.sessionId
              if (id === undefined) return
              void requirePorts()
                .clipboard.setString(id)
                .then(() => {
                  // Says so on the button itself and goes back on its own. Anything longer-lived
                  // would need somewhere to put a toast, which no screen here has yet.
                  setCopied(true)
                  setTimeout(() => {
                    setCopied(false)
                  }, 2000)
                })
            }}
          >
            {copied ? tr('copied') : tr('copy')}
          </Button>
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
