import { flag } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Button, Screen, Text, useMedia, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { LanguageButton } from './LanguageButton'

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

  /**
   * Where the language button goes, which is the one thing the two platforms disagree about: in
   * the row with the other buttons on a desktop window, and in the top corner on a phone.
   *
   * Decided by width rather than by platform, the same axis `AdaptiveShell` uses. A tablet in
   * landscape is a desktop window as far as this screen is concerned, and the alternative --
   * a `.native.tsx` pair -- would fork the whole screen to move one control.
   */
  const wide = useMedia().gtSm
  // Off by default. Until it is on there is no way to change the language at all, which is the
  // honest state: the picker sets it for this run only, because the one preference store the app
  // has lives behind an identity that does not exist yet on this screen.
  const languageSelect = flag('onboardingLanguageSelect')

  return (
    <Screen padded testID={ELEMENT.onboarding.screen}>
      <XStack justifyContent="flex-end" minHeight="$7">
        {languageSelect && !wide ? <LanguageButton /> : null}
      </XStack>

      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
        <Text size="$headingLarge" weight="bold">
          {tr('appName')}
        </Text>
        <XStack alignItems="center" gap="$1">
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
            {busy ? tr('loading') : tr('onboardingAccountCreate')}
          </Button>
          {languageSelect && wide ? <LanguageButton /> : null}
        </XStack>

        {failed === null ? null : (
          <Text tone="danger" size="$caption">
            {failed}
          </Text>
        )}
      </YStack>
    </Screen>
  )
}
