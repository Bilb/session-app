import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, PressArea, useToast, XStack, YStack } from '@session/ui'

import { AccountIdText } from './AccountIdText'
import type { AccountIdControlsProps } from './AccountIdControls.types'

/**
 * The ID with a copy glyph at its trailing side, centred on its three lines. The ID copies when
 * pressed as well, and either raises the same toast.
 */
export function AccountIdControls({ sessionId }: AccountIdControlsProps) {
  const toasts = useToast()
  const copy = () => {
    void requirePorts()
      .clipboard.setString(sessionId)
      .then(() => {
        // One id for every copy, so copying twice shows the toast again rather than two of them.
        toasts.show(tr('copied'), { id: 'copied-to-clipboard' })
      })
  }
  return (
    <XStack alignItems="center" gap="$xs">
      <PressArea accessibilityLabel={tr('copy')} onPress={copy}>
        {() => (
          <YStack cursor="pointer">
            <AccountIdText sessionId={sessionId} />
          </YStack>
        )}
      </PressArea>
      <Button
        variant="ghost"
        size="xs"
        circular
        accessibilityLabel={tr('copy')}
        testID={ELEMENT.settings.copyAccountId}
        onPress={copy}
        icon={<Icon name="copy" size="sm" color="$accentText" />}
      />
    </XStack>
  )
}
