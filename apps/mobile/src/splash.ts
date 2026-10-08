import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

// From module load, which is before the first frame: the native launch screen stays up until the
// app has something to draw rather than giving way to an empty root view.
void SplashScreen.preventAutoHideAsync()

/**
 * Takes the launch screen down when it mounts.
 *
 * Rendered as part of whatever is drawn first, so it mounts with the first paint and not before:
 * the start placeholder, or the tree `StoredThemeProvider` draws once it stops holding.
 */
export function HideSplashOnMount() {
  useEffect(() => {
    void SplashScreen.hideAsync()
  }, [])
  return null
}
