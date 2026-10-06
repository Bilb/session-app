import type { BackdropBlur } from '@session/ui'
import { BlurView } from 'expo-blur'
import { Platform, StyleSheet } from 'react-native'

/**
 * `expo-blur` takes an intensity on top of the material, where UIKit takes only the material, so
 * 100 is the full material; with no scrim behind it, the blur is the whole backdrop. Light
 * is eased to 80 because the full light material reads as nearly opaque over a light page.
 */
const INTENSITY = { dark: 100, light: 80 } as const

/**
 * What the legacy client puts behind a modal on iOS, and nowhere else.
 *
 * Null on Android, where the clients only darken -- the platform has no equivalent view, and
 * `expo-blur`'s Android path is a shader approximation rather than the system's own. This is the
 * deviation being deliberate rather than the port being incomplete.
 */
export const mobileBackdropBlur: BackdropBlur | null =
  Platform.OS === 'ios'
    ? ({ dark }) => (
        <BlurView
          /*
           * The client's own material: `Modal.dimmingView` is a `UIVisualEffectView` built with
           * `.systemUltraThinMaterial`.
           *
           * **Chosen from the app's theme, not the device's.** The adaptive material resolves
           * against the system appearance, so a phone in light mode showing a dark theme would get
           * a pale frost over a black screen. The legacy client avoids that by setting the
           * window's `overrideUserInterfaceStyle` from the chosen theme; nothing does that here,
           * so the tint is named outright instead -- which is the same pair the client ends up
           * with (`.systemUltraThinMaterialLight` for `classicLight` and `oceanLight`).
           */
          tint={dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          intensity={dark ? INTENSITY.dark : INTENSITY.light}
          style={StyleSheet.absoluteFill}
        />
      )
    : null
