import { requirePorts, useCamera } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, ScannerFrame, Text, useScreenInsets, YStack } from '@session/ui'
import { useCallback, useRef, type ReactNode } from 'react'

/** How far the message floats above the home indicator. */
const MESSAGE_LIFT = 16

interface ScanQrPaneProps {
  /** A scanned code, as read. Whether it is a recovery seed is not this pane's to decide. */
  onScan: (value: string) => void
  /**
   * Whether this pane is the one being looked at.
   *
   * The pager keeps both mounted so a half-typed phrase survives a look at the other tab, so
   * being mounted is not being shown -- and a camera left running behind the phrase field lights
   * the platform's recording indicator while somebody types their recovery phrase.
   */
  showing?: boolean
  /** Shown under the frame. The bridge's refusal of whatever was scanned. */
  error?: string | null
}

/**
 * The other way into a restore: point the camera at somebody else's recovery QR.
 *
 * **Four states, and the clients draw all four.** Nobody has been asked yet, or asked and refused
 * -- both offer to ask again. Refused permanently, where asking again does nothing and the only
 * way forward is the app's own settings page. And granted, which is the camera itself.
 *
 * What the button says differs by platform, and the reason is worth knowing: see `ask` on the
 * camera port.
 */
export function ScanQrPane({ onScan, showing = true, error = null }: ScanQrPaneProps) {
  const camera = useCamera()
  const insets = useScreenInsets()
  /**
   * The code this pane has already handed over.
   *
   * **A scanner reports every frame a code decodes in, not the first.** Holding the camera over
   * one is thirty reads a second, and each one starts a restore of the same seed -- so the first
   * wins and every loser reports a failure over a camera that scanned correctly. Latched on the
   * value rather than on a flag, so a different code is still read if the camera is moved.
   */
  const handed = useRef<string | null>(null)
  const handleScan = useCallback(
    (value: string) => {
      if (handed.current === value) return
      handed.current = value
      onScan(value)
    },
    [onScan],
  )

  if (camera === null) {
    // Desktop. Nothing to offer and nothing to ask for, so the pane says what is true rather than
    // showing a control that cannot work.
    return <Message testID={ELEMENT.onboarding.scanQrPane} text={tr('cameraGrantAccessQr')} />
  }

  if (camera.access === 'granted') {
    return (
      /**
       * **To the bottom of the window, under the home indicator.** A camera that stops at the
       * content box leaves a black bar along the bottom, which reads as the preview having failed
       * rather than as the device's own furniture.
       */
      <YStack
        flex={1}
        overflow="hidden"
        marginBottom={-insets.bottom}
        testID={ELEMENT.onboarding.scanQrPane}
      >
        <camera.Preview
          onScan={handleScan}
          active={showing}
          testID={ELEMENT.onboarding.scanQrPreview}
        />
        <ScannerFrame />
        {/* Over the picture rather than under it, which is where the client puts it -- a row
            beneath would take a strip of the preview away permanently for a message that is
            usually not there. On its own surface, because red on whatever the camera happens to be
            pointed at is not reliably readable. */}
        {error === null ? null : (
          <YStack
            position="absolute"
            left="$xl"
            right="$xl"
            bottom={insets.bottom + MESSAGE_LIFT}
            pointerEvents="none"
            alignItems="center"
            paddingHorizontal="$xl"
            paddingVertical="$md"
            borderRadius="$lg"
            backgroundColor="$backgroundSecondary"
          >
            <Text tone="danger" size="$label" weight="bold" textAlign="center">
              {error}
            </Text>
          </YStack>
        )}
      </YStack>
    )
  }

  const blocked = camera.access === 'blocked'

  return (
    <Message
      testID={ELEMENT.onboarding.scanQrPane}
      text={blocked ? tr('cameraGrantAccessDenied') : tr('cameraGrantAccessQr')}
      action={
        <Button
          variant="ghostAccent"
          testID={ELEMENT.onboarding.cameraAccess}
          onPress={() => {
            if (blocked) {
              // Asking again does nothing once it is blocked; the settings page is the only place
              // this can be changed from.
              void requirePorts().linking.openAppSettings?.()
              return
            }
            void camera.request()
          }}
        >
          {blocked
            ? tr('sessionSettings')
            : camera.ask === 'grant'
              ? tr('cameraGrantAccess')
              : tr('theContinue')}
        </Button>
      }
    />
  )
}

/** The pane with nothing to show through: a line of explanation, centred, and maybe a control. */
function Message({ text, action, testID }: { text: string; action?: ReactNode; testID: string }) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$md"
      paddingHorizontal="$3xl"
      testID={testID}
    >
      <Text textAlign="center">{text}</Text>
      {action}
    </YStack>
  )
}
