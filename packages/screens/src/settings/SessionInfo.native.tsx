import { requirePorts, URLS } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { PressArea, SessionTokenLogo, Text, useModals, YStack } from '@session/ui'

import { confirmLink } from './confirmLink'
import { useDebugModePresses } from './debugModePresses'

const LOGO_HEIGHT = 24

/**
 * The foot of the settings page: the network's logo, then the build on one line --
 * "Version 1.2.3 (45 - abcdef12)", from the catalogue's `updateVersion`. Pressing the line is how
 * debug mode is turned over.
 */
export function SessionInfo() {
  const modals = useModals()
  const onVersionPress = useDebugModePresses()
  const { version, commit, buildNumber } = requirePorts().build
  const detail = [buildNumber, commit].filter((part) => part !== null).join(' - ')

  return (
    <YStack alignItems="center" gap="$2xs">
      <PressArea
        accessibilityLabel={URLS.token}
        testID={ELEMENT.settings.tokenLogo}
        onPress={() => {
          confirmLink(modals, URLS.token)
        }}
      >
        {() => <SessionTokenLogo size={LOGO_HEIGHT} color="$textSecondary" />}
      </PressArea>
      <PressArea testID={ELEMENT.settings.version} onPress={onVersionPress}>
        {() => (
          <Text size="$label" tone="secondary" textAlign="center">
            {tr('updateVersion', { version: detail === '' ? version : `${version} (${detail})` })}
          </Text>
        )}
      </PressArea>
    </YStack>
  )
}
