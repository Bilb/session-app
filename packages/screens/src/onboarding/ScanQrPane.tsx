import { requirePorts, useCamera } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Text, YStack } from '@session/ui'
import type { ReactNode } from 'react'

interface ScanQrPaneProps {
  /** A scanned code, as read. Whether it is a recovery seed is not this pane's to decide. */
  onScan: (value: string) => void
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
export function ScanQrPane({ onScan, error = null }: ScanQrPaneProps) {
  const camera = useCamera()

  if (camera === null) {
    // Desktop. Nothing to offer and nothing to ask for, so the pane says what is true rather than
    // showing a control that cannot work.
    return <Message testID={ELEMENT.onboarding.scanQrPane} text={tr('cameraGrantAccessQr')} />
  }

  if (camera.access === 'granted') {
    return (
      <YStack flex={1} testID={ELEMENT.onboarding.scanQrPane}>
        <YStack flex={1} overflow="hidden" borderRadius="$3">
          <camera.Preview onScan={onScan} testID={ELEMENT.onboarding.scanQrPreview} />
        </YStack>
        {/* Under the frame rather than over it: a message printed on the picture is unreadable
            against whatever the camera happens to be pointed at. */}
        <YStack minHeight="$5" paddingTop="$2" alignItems="center">
          {error === null ? null : (
            <Text tone="danger" size="$label" weight="bold" textAlign="center">
              {error}
            </Text>
          )}
        </YStack>
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
      gap="$2"
      paddingHorizontal="$4"
      testID={testID}
    >
      <Text textAlign="center">{text}</Text>
      {action}
    </YStack>
  )
}
