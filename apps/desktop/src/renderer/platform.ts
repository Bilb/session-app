import { memoryPorts, setPorts } from '@session/app'
import { parseNetworkName } from '@session/basic-types'

/**
 * The desktop app's OS ports.
 *
 * Only the ones the walking skeleton needs are real; the rest are the memory
 * implementations, which do nothing rather than pretending. Each becomes an IPC call to the
 * main process as its screen arrives - file pickers and notifications live over there,
 * because that is where Electron's dialog and Notification are.
 */
setPorts(
  memoryPorts({
    // The same variable and the same parser the main process uses, inlined at build time.
    network: {
      name: parseNetworkName(import.meta.env.EXPO_PUBLIC_SESSION_NETID),
      // Substituted at build time for the same reason as the netid: the renderer cannot read the
      // environment.
      usingFake: import.meta.env.SESSION_FAKE === '1',
    },
    // Substituted at build time alongside the netid, because the renderer cannot read the
    // environment. That makes a desktop override a rebuild rather than a relaunch -- worth fixing
    // once the preload has an IPC surface to carry it, since a flag you cannot flip on someone
    // else's machine does half of what a flag is for.
    flags: {
      override: (name) => import.meta.env.SESSION_FLAGS?.[name] ?? null,
    },
    window: {
      // One window, so closing it is quitting. `window.close()` rather than an IPC call because
      // there is no IPC surface in the preload yet and this needs none.
      close: () => {
        window.close()
      },
      isFocused: () => document.hasFocus(),
      onFocusChange: (handler) => {
        const onFocus = () => handler(true)
        const onBlur = () => handler(false)
        window.addEventListener('focus', onFocus)
        window.addEventListener('blur', onBlur)
        return () => {
          window.removeEventListener('focus', onFocus)
          window.removeEventListener('blur', onBlur)
        }
      },
    },
    linking: {
      /**
       * Handed to the main process, which shells it out to the real browser -- see the window-open
       * handler there. `window.open` rather than an IPC call of our own because the handler is
       * already the seam Electron gives for this, and adding a second one would mean two places
       * that decide which URLs may leave.
       */
      openUrl: (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
        return Promise.resolve()
      },
      // No per-app language screen to hand over to on desktop. See the port.
      // No OS settings page for a desktop app to send anybody to; the app's own settings are in
      // the app. Null rather than a no-op, for the reason the row above gives.
      openAppSettings: null,
    },
    clipboard: {
      setString: (value) => navigator.clipboard.writeText(value),
      getString: () => navigator.clipboard.readText(),
    },
  }),
)
