import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { Modal, Screen, Text, YStack } from '@session/ui'
import { ELEMENT } from '@session/test-ids'
import { useState } from 'react'

import { LocalizedText } from './LocalizedText'
import { TextButton } from './TextButton'

interface StartupFailedScreenProps {
  /** libsession's own words. Shown, because they are the only thing that says which failure it was. */
  error: string
}

/**
 * The app could not start.
 *
 * **The second outcome of a launch.** Without it, a rejection between the app opening and
 * libsession answering is indistinguishable from a database still migrating: the launch screen
 * stays up and neither ever ends.
 *
 * A styled screen rather than the legacy client's plain `UIAlertController`. Its reason for the
 * plain one holds here too -- it *"may not have access to the database when displaying this so
 * can't extract theme information"* -- but costs nothing, because the default theme is already
 * what the launch screen was drawn in.
 *
 * **Clearing is the only way forward offered**, and it covers both of the client's two: they differ
 * only in what happens next, which here is onboarding, where a phrase is entered. No retry -- iOS
 * has none either, and the thing that would make the failure go away is what already failed.
 * Exporting the logs is absent because there is no logging port to write them.
 */
export function StartupFailedScreen({ error }: StartupFailedScreenProps) {
  const actions = useSessionActions()
  const close = requirePorts().window.close
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  const clear = () => {
    setClearing(true)
    void actions
      .clearDeviceData()
      .then(() => {
        // The process is now holding a database that no longer exists, so it ends rather than
        // carries on -- which is what makes the next launch the clean one, and what the legacy
        // clients do. Where the platform cannot end it, the screen stays put and the person
        // relaunches; see `WindowPort`.
        close?.()
      })
      .finally(() => {
        setClearing(false)
        setConfirming(false)
      })
  }

  return (
    <Screen padded testID={ELEMENT.startupFailed.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$xl">
        <YStack maxWidth={420} gap="$md" alignItems="center">
          <Text size="$titleLarge" weight="bold" textAlign="center">
            {tr('theError')}
          </Text>
          <LocalizedText text={tr('databaseErrorGeneric')} textAlign="center" />
          {/* libsession's message, kept apart from the explanation and drawn quieter. It is not
              written for anybody in particular, but it is the only thing in this screen that
              differs between one failure and another, and somebody reading a screenshot back to
              us needs it. */}
          <Text
            tone="secondary"
            size="$caption"
            textAlign="center"
            testID={ELEMENT.startupFailed.reason}
          >
            {error}
          </Text>
        </YStack>

        <YStack gap="$sm" width="100%" maxWidth={348}>
          <TextButton
            label={['clearDevice']}
            variant="outline"
            destructive
            testID={ELEMENT.startupFailed.clear}
            onPress={() => {
              setConfirming(true)
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

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false)
        }}
        title={tr('clearDevice')}
        closeLabel={tr('cancel')}
        testID={ELEMENT.startupFailed.confirmClear}
        closeTestID={ELEMENT.startupFailed.cancelClear}
        actions={
          <TextButton
            label={['clearDevice']}
            variant="ghost"
            destructive
            loading={clearing}
            testID={ELEMENT.startupFailed.confirmClearButton}
            onPress={clear}
          />
        }
      >
        <LocalizedText text={tr('clearDeviceDescription')} />
      </Modal>
    </Screen>
  )
}
