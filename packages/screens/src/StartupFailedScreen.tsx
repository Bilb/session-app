import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { Button, Modal, Screen, Text, YStack } from '@session/ui'
import { ELEMENT } from '@session/test-ids'
import { useState } from 'react'

import { LocalizedText } from './LocalizedText'

interface StartupFailedScreenProps {
  /** libsession's own words. Shown, because they are the only thing that says which failure it was. */
  error: string
}

/**
 * The app could not start.
 *
 * **The second outcome of a launch, and until now there was only one.** Everything between the app
 * opening and libsession answering either finished or left the launch screen up for ever -- a
 * rejection with nobody holding it looked exactly like a database still migrating, and neither
 * ever ended. This is what a failure resolves to instead.
 *
 * The legacy iOS client puts a plain `UIAlertController` over its own launch screen rather than a
 * styled one, and says why: it *"may not have access to the database when displaying this so can't
 * extract theme information for styling purposes"*. The same is true here -- a theme preference
 * lives in libsession's globals, and libsession is what has not answered -- but it costs us
 * nothing, because the default theme is already what the launch screen was drawn in. So this is a
 * screen rather than a system alert, and it is styled, and neither of those contradicts the
 * client's reasoning.
 *
 * **Clearing is the only way forward offered**, and it is both of the client's two: there, "clear"
 * and "clear and restore" differ only in what happens next, and what happens next here is
 * onboarding, which is where a recovery phrase is entered. A retry is deliberately absent -- iOS
 * has none either, and the one thing that would have made the failure go away is the thing that
 * already failed.
 *
 * Exporting the logs, which the client offers first, is not here: there is no logging port yet, so
 * the button would be a promise to produce a file nothing writes.
 */
export function StartupFailedScreen({ error }: StartupFailedScreenProps) {
  const actions = useSessionActions()
  const close = requirePorts().window.close
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  const clear = () => {
    setClearing(true)
    void actions.clearDeviceData().finally(() => {
      setClearing(false)
      setConfirming(false)
    })
  }

  return (
    <Screen padded testID={ELEMENT.startupFailed.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
        <YStack maxWidth={420} gap="$2" alignItems="center">
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

        <YStack gap="$1.5" width="100%" maxWidth={348}>
          <Button
            variant="outline"
            destructive
            testID={ELEMENT.startupFailed.clear}
            onPress={() => {
              setConfirming(true)
            }}
          >
            {tr('clearDevice')}
          </Button>
          {close === null ? null : (
            <Button
              variant="outline"
              testID={ELEMENT.startupFailed.quit}
              onPress={() => {
                close()
              }}
            >
              {tr('quit')}
            </Button>
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
          <Button
            variant="ghost"
            destructive
            loading={clearing}
            testID={ELEMENT.startupFailed.confirmClearButton}
            onPress={clear}
          >
            {tr('clearDevice')}
          </Button>
        }
      >
        <LocalizedText text={tr('clearDeviceDescription')} />
      </Modal>
    </Screen>
  )
}
