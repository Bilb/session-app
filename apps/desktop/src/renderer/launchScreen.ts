import { DURATION } from '@session/theme-tokens'
import { useEffect } from 'react'

/** Past the fade's own length, in case `transitionend` never arrives -- a hidden window, say. */
const REMOVE_BACKSTOP_MS = DURATION.launchFade + 200

/**
 * Fades the page's launch screen off the app when it mounts, then removes it.
 *
 * Rendered inside `StoredThemeProvider`, so it mounts with the app's first paint and not before:
 * the starting screen, or the screen the account opens on. The launch screen is written into the
 * page by `launchScreenPlugin` in electron.vite.config.ts.
 *
 * Clicks pass through while it fades, since the app underneath is already live. Removed at once
 * where the system asks for reduced motion.
 */
export function RemoveLaunchScreenOnMount() {
  useEffect(() => {
    const screen = document.getElementById('launch-screen')
    if (screen === null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      screen.remove()
      return
    }
    screen.style.pointerEvents = 'none'
    screen.style.transition = `opacity ${String(DURATION.launchFade)}ms ease-out`
    // Read back so the opaque state is laid out before it changes; otherwise there is nothing to
    // transition from and it disappears at once.
    void screen.offsetWidth
    screen.style.opacity = '0'
    const remove = () => {
      screen.remove()
    }
    screen.addEventListener('transitionend', remove, { once: true })
    const backstop = setTimeout(remove, REMOVE_BACKSTOP_MS)
    return () => {
      clearTimeout(backstop)
    }
  }, [])
  return null
}
