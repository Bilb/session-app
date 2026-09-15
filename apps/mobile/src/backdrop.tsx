import type { BackdropBlur } from '@session/ui'
import { BlurView } from 'expo-blur'
import { Platform, StyleSheet } from 'react-native'

/**
 * How strong the blur is.
 *
 * `expo-blur` takes a 0-100 intensity as well as a material, where UIKit takes only the material,
 * so full strength is what asks for the material as the legacy client gets it. There is no scrim
 * behind this -- the blur is the whole backdrop, as it is there -- so anything less separates the
 * dialog from the page less than the client does.
 */
const INTENSITY = 100

/**
 * What the legacy client puts behind a modal on iOS, and nowhere else.
 *
 * Null on Android, where the clients only darken -- the platform has no equivalent view, and
 * `expo-blur`'s Android path is a shader approximation rather than the system's own. This is the
 * deviation being deliberate rather than the port being incomplete.
 */
export const mobileBackdropBlur: BackdropBlur | null =
  Platform.OS === 'ios'
    ? () => (
        <BlurView
          /*
           * The client's own material: `Modal.dimmingView` is a `UIVisualEffectView` built with
           * `.systemUltraThinMaterial`.
           *
           * **Pinned to the dark one rather than the adaptive one**, which the client can afford
           * and we cannot yet: it sets the window's `overrideUserInterfaceStyle` from the theme a
           * person chose, so the adaptive material resolves the way the app looks. Nothing sets
           * that here and the app is dark whatever the device is, so the adaptive material would
           * come back light on a phone in light mode -- a pale frost over a black screen. When
           * light themes reach mobile this has to follow the theme, as the client's does
           * (`.systemUltraThinMaterialLight` for `classicLight`/`oceanLight`).
           */
          tint="systemUltraThinMaterialDark"
          intensity={INTENSITY}
          style={StyleSheet.absoluteFill}
        />
      )
    : null
