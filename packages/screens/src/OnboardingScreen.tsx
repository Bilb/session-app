import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Button, Screen, Text, YStack } from '@session/ui'
import { useState } from 'react'

/**
 * The first screen, and the only one that exists before an identity does.
 *
 * Creating an account is also the moment the app goes online: the bridge attaches the network
 * on the far side of it, because attaching to an identity-less Core throws. Restoring from a
 * recovery phrase belongs here too and is not built yet - the bridge has the command.
 */
export function OnboardingScreen() {
  const actions = useSessionActions()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  return (
    <Screen padded testID={ELEMENT.onboarding.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
        <Text size="$9" weight="bold">
          Session
        </Text>
        <Text tone="secondary">No account on this device yet.</Text>

        <Button
          testID={ELEMENT.onboarding.createAccount}
          disabled={busy}
          onPress={() => {
            setBusy(true)
            setFailed(null)
            actions.createAccount().catch((error: unknown) => {
              setFailed(error instanceof Error ? error.message : String(error))
              setBusy(false)
            })
          }}
        >
          {busy ? 'Creating…' : tr('onboardingAccountCreate')}
        </Button>

        {failed === null ? null : (
          <Text tone="danger" size="$2">
            {failed}
          </Text>
        )}
      </YStack>
    </Screen>
  )
}
