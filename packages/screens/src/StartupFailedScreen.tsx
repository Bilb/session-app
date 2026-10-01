import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  Icon,
  Screen,
  Text,
  useModals,
  useToast,
  XStack,
  YStack,
  type Modals,
} from '@session/ui'
import { useState } from 'react'

import { LocalizedText } from './LocalizedText'
import { TextButton } from './TextButton'

interface StartupFailedScreenProps {
  /**
   * libsession's own words. Shown, because they are the only thing that says which failure it was.
   */
  error: string
}

/**
 * The app could not start.
 *
 * **The second outcome of a launch.** Without it, a rejection between the app opening and
 * libsession answering is indistinguishable from a database still migrating: the launch screen
 * stays up and neither ever ends. Drawn in the default theme, which is what the launch screen was
 * drawn in -- the theme is a preference in the database that just failed to open.
 *
 * **Clearing is the only way forward offered**, and it leads to onboarding, where somebody either
 * starts again or enters their recovery phrase. No Retry: `start` runs the queries again, but the
 * failures that land here -- a database that will not open, a migration that did not finish --
 * happen in the bridge's init, which it does not repeat.
 *
 * TODO: an Export Logs button, once the app keeps logs. The explanation asks for them, and nothing
 * here lets somebody hand them over.
 */
export function StartupFailedScreen({ error }: StartupFailedScreenProps) {
  const actions = useSessionActions()
  const modals = useModals()
  const close = requirePorts().window.close

  return (
    <Screen padded testID={ELEMENT.startupFailed.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$xl">
        <YStack maxWidth={420} gap="$md" alignItems="center">
          <Text size="$titleLarge" weight="bold" textAlign="center">
            {tr('theError')}
          </Text>
          <LocalizedText text={tr('databaseErrorGeneric')} textAlign="center" />
          <FailureReason error={error} />
        </YStack>

        <YStack gap="$sm" width="100%" maxWidth={348}>
          <TextButton
            label={['clearDevice']}
            variant="danger"
            testID={ELEMENT.startupFailed.clear}
            onPress={() => {
              confirmClear(modals, async () => {
                await actions.clearDeviceData()
                // The process is now holding a database that no longer exists, so it ends rather
                // than carries on, which is what makes the next launch the clean one. Where it
                // cannot be ended the screen stays put and the person relaunches.
                close?.()
              })
            }}
          />
          {close === null ? null : (
            <TextButton
              label={['quit']}
              variant="outline"
              testID={ELEMENT.startupFailed.quit}
              onPress={() => {
                close()
              }}
            />
          )}
        </YStack>
      </YStack>
    </Screen>
  )
}

/**
 * libsession's message, apart from the explanation and drawn quieter, with a control that copies
 * it. It is the only thing on this screen that differs between one failure and another, and it is
 * what support needs.
 */
function FailureReason({ error }: { error: string }) {
  const toasts = useToast()
  const copy = () => {
    void requirePorts()
      .clipboard.setString(error)
      .then(() => {
        toasts.show(tr('copied'), { id: 'copied-to-clipboard' })
      })
  }
  return (
    <XStack alignItems="center" gap="$xs">
      <Text
        flexShrink={1}
        tone="secondary"
        size="$caption"
        textAlign="center"
        testID={ELEMENT.startupFailed.reason}
      >
        {error}
      </Text>
      <Button
        variant="ghost"
        size="xs"
        circular
        accessibilityLabel={tr('copy')}
        testID={ELEMENT.startupFailed.copyReason}
        onPress={copy}
        icon={<Icon name="copy" size="sm" color="$textSecondary" />}
      />
    </XStack>
  )
}

/** Asks before clearing, as every other destructive confirmation does: Clear beside Cancel. */
function confirmClear(modals: Modals, clear: () => Promise<void>): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.startupFailed.confirmClear,
    // No cross: somebody deciding whether to erase their account should read the word Cancel.
    showClose: false,
    initial: {
      title: tr('clearDevice'),
      render: () => (
        <LocalizedText text={tr('clearDeviceDescription')} size="$body" textAlign="center" />
      ),
      footer: () => <ClearActions modals={modals} id={id} clear={clear} />,
    },
  })
}

/** Locked while the clear runs, so nothing can look like a cancel of what is already happening. */
function ClearActions({
  modals,
  id,
  clear,
}: {
  modals: Modals
  id: string
  clear: () => Promise<void>
}) {
  const [running, setRunning] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        fill
        borderRadius="$none"
        destructive
        disabled={running}
        testID={ELEMENT.startupFailed.confirmClearButton}
        onPress={() => {
          setRunning(true)
          modals.lock(id)
          void clear().finally(() => {
            modals.dismissAll()
          })
        }}
      >
        {tr('clear')}
      </Button>
      <Button
        variant="ghost"
        fill
        borderRadius="$none"
        disabled={running}
        testID={ELEMENT.startupFailed.cancelClear}
        onPress={() => {
          modals.dismiss(id)
        }}
      >
        {tr('cancel')}
      </Button>
    </>
  )
}
