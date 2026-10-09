import { useEffect } from 'react'

/**
 * Takes the page's launch screen down when it mounts.
 *
 * Rendered inside `StoredThemeProvider`, so it mounts with the app's first paint and not before:
 * the starting screen, or the screen the account opens on. The launch screen is written into the
 * page by `launchScreenPlugin` in electron.vite.config.ts.
 */
export function RemoveLaunchScreenOnMount() {
  useEffect(() => {
    document.getElementById('launch-screen')?.remove()
  }, [])
  return null
}
