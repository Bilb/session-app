import { requireNativeModule, requireNativeView } from 'expo'
import type { ComponentType } from 'react'
import type { ViewStyle } from 'react-native'

import type { CameraPermission } from './cameraAccess'

/** `modules/qr-scanner`, Android only: the camera permission, asked and read. */
interface QrScannerModule {
  getPermissionAsync(): Promise<CameraPermission>
  requestPermissionAsync(): Promise<CameraPermission>
}

export interface QrScannerViewProps {
  style?: ViewStyle | undefined
  /** False stops the camera without unmounting the view. */
  active: boolean
  /**
   * A QR code's text, each time one is read: a code held in view is reported again a moment later.
   */
  onScan: (event: { nativeEvent: { data: string } }) => void
  testID?: string | undefined
}

export const QrScanner = requireNativeModule<QrScannerModule>('QrScanner')

/** The live preview, decoding QR codes from its frames on the native side. */
export const QrScannerView: ComponentType<QrScannerViewProps> =
  requireNativeView<QrScannerViewProps>('QrScanner')
