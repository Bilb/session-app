import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { ScreenInsets } from './screenInsets.types'

export type { ScreenInsets }

/**
 * What the hardware takes out of the window: the notch, the home indicator, the rounded corners.
 *
 * `Screen` already holds its content clear of all four, which is what almost everything wants.
 * This is for the exception -- something that should run *under* one of them, like a camera
 * preview, which has to know how far past the content box to reach.
 *
 * Needs a SafeAreaProvider above it, which the app's root layout installs.
 */
export function useScreenInsets(): ScreenInsets {
  return useSafeAreaInsets()
}
