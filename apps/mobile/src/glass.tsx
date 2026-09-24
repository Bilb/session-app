import type { Glass } from '@session/ui'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { Platform } from 'react-native'

/**
 * The glass iOS 26 draws its bar buttons on, and nothing anywhere else.
 *
 * Null before iOS 26 and on Android, which have no glass: the controls that would sit on it keep
 * their own drawing there.
 */
export const mobileGlass: Glass | null =
  Platform.OS === 'ios' && isLiquidGlassAvailable()
    ? ({ size, dark, children }) => (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          // The app's theme rather than the device's, for the reason the backdrop blur names its
          // tint: a phone in light mode showing a dark theme would otherwise get pale glass.
          colorScheme={dark ? 'dark' : 'light'}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </GlassView>
      )
    : null
