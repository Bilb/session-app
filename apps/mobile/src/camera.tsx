import { CameraProvider, type CameraAccess, type CameraPort } from '@session/app'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useMemo, type ReactNode } from 'react'
import { Platform } from 'react-native'

/**
 * expo-camera, behind the port.
 *
 * The preview is a component rather than a call, which is why this is a provider and not a row in
 * `platform.ts`: a camera is something drawn, and the frames it reads QR codes out of never leave
 * the native side.
 */
export function MobileCameraProvider({ children }: { children: ReactNode }) {
  const [permission, request] = useCameraPermissions()

  const camera = useMemo<CameraPort>(
    () => ({
      access: read(permission),
      // Apple's review is the reason the two platforms differ; `CameraPort` in
      // `packages/app/src/ports.ts` says what each value promises.
      ask: Platform.OS === 'ios' ? 'continue' : 'grant',
      request: async () => read(await request()),
      Preview: ({ onScan, active = true, testID }) => (
        <CameraView
          style={{ flex: 1 }}
          // Stopped rather than unmounted, because the pager keeps every page mounted on purpose.
          active={active}
          facing="back"
          // QR only. A scanner that also read barcodes would happily accept a supermarket label as
          // a recovery phrase and then fail somewhere further in.
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            onScan(data)
          }}
          {...(testID === undefined ? {} : { testID })}
        />
      ),
    }),
    [permission, request],
  )

  return <CameraProvider camera={camera}>{children}</CameraProvider>
}

/**
 * What expo-camera reports, as the four states a screen actually has to draw.
 *
 * **`undetermined` is not a refusal**, which is the distinction worth keeping: it means nobody has
 * been asked, so the button offers to ask. `canAskAgain` is what separates a refusal that can be
 * asked about again from one only the settings page can undo.
 */
function read(
  permission: { granted: boolean; canAskAgain: boolean; status: string } | null,
): CameraAccess {
  if (!permission || permission.status === 'undetermined') return 'unknown'
  if (permission.granted) return 'granted'
  return permission.canAskAgain ? 'denied' : 'blocked'
}
