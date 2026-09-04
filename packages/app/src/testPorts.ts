import type { Ports } from './ports'

/**
 * Ports that do nothing, for tests and for the dev loop before an app has real ones.
 *
 * Having a whole platform be a handful of closures is the point of the ports being an
 * interface: a suite installs these instead of stubbing an OS.
 */
export function memoryPorts(overrides: Partial<Ports> = {}): Ports {
  let databaseKey: Uint8Array | null = null
  let clipboard = ''
  const notificationTaps = new Set<(conversationId: string) => void>()
  const focusHandlers = new Set<(focused: boolean) => void>()

  return {
    secureStore: {
      getDatabaseKey: () => Promise.resolve(databaseKey),
      setDatabaseKey: (key) => {
        databaseKey = key
        return Promise.resolve()
      },
    },
    files: {
      pickFiles: () => Promise.resolve([]),
      pickImages: () => Promise.resolve([]),
      chooseSaveLocation: () => Promise.resolve(null),
      openPath: () => Promise.resolve(),
      revealInFolder: () => Promise.resolve(),
    },
    mediaProbe: {
      imageSize: () => Promise.resolve(null),
    },
    notifications: {
      requestPermission: () => Promise.resolve(true),
      show: () => Promise.resolve(),
      onTap: (handler) => {
        notificationTaps.add(handler)
        return () => notificationTaps.delete(handler)
      },
      setBadgeCount: () => Promise.resolve(),
    },
    clipboard: {
      setString: (value) => {
        clipboard = value
        return Promise.resolve()
      },
      getString: () => Promise.resolve(clipboard),
    },
    linking: {
      openUrl: () => Promise.resolve(),
    },
    window: {
      isFocused: () => true,
      onFocusChange: (handler) => {
        focusHandlers.add(handler)
        return () => focusHandlers.delete(handler)
      },
    },
    ...overrides,
  }
}
