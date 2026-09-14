import { memoryPorts, setPorts } from '@session/app'
import { parseNetworkName } from '@session/basic-types'
import * as Clipboard from 'expo-clipboard'
import * as SecureStore from 'expo-secure-store'
import { Linking, Platform } from 'react-native'

const DATABASE_KEY = 'session2.database-key'

// Hex rather than base64: the keychain stores strings, and hex needs no polyfill on either
// platform's JavaScript engine.
function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * The mobile app's OS ports.
 *
 * Real where a screen has arrived that needs it, and a memory implementation everywhere else.
 *
 * A memory port left in place fails silently on a device: the write lands in a variable, nothing
 * throws, and the screen looks like it worked. So a port stays memory only while nothing on any
 * screen depends on it reaching the OS.
 */
setPorts(
  memoryPorts({
    // The same variable and the same parser store.ts gives the transport, so the overlay cannot
    // name a network libsession never attached to. EXPO_PUBLIC_ for the reason store.ts gives.
    network: { name: parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID']) },
    // Expo inlines every EXPO_PUBLIC_* variable, so a flag is read by its prefixed name.
    flags: { override: (name) => process.env[`EXPO_PUBLIC_${name}`] ?? null },
    notifications: {
      // Both mobile operating systems stop the app when it leaves the screen, which is what makes
      // notification delivery something to choose rather than something that just happens. True on
      // a tablet as well as a phone: it is the OS that decides this, not the screen size.
      notificationModesApply: true,
      // Unchanged, and repeated because a port override replaces the whole object rather than
      // merging into it. See memoryPorts.
      fastModeAvailable: false,
      requestPermission: () => Promise.resolve(true),
      show: () => Promise.resolve(),
      onTap: () => () => undefined,
      setBadgeCount: () => Promise.resolve(),
    },
    clipboard: {
      setString: (value) => Clipboard.setStringAsync(value).then(() => undefined),
      getString: () => Clipboard.getStringAsync(),
    },
    linking: {
      // Unchanged, and repeated because a port override replaces the whole object rather than
      // merging into it. See memoryPorts.
      openUrl: (url) => Linking.openURL(url),
      /**
       * **iOS only, and only because iOS is the only one of the two that can show the row.**
       *
       * `openSettings` opens this app's own page in Settings, where iOS lists Preferred Language --
       * but only for a bundle that declares more than one localization, which is what the
       * `CFBundleLocalizations` list in `app.config.ts` is for. Without that list the row is not
       * there and this would land somebody on a settings page with nothing to change.
       *
       * Null on Android, which is not a stub: App Language exists there from 13 onwards and only
       * for an app shipping a `localeConfig`, and this app has no Android build to put one in yet.
       * Null is what the picker reads to mean "do it yourself", which is the right answer until
       * then -- see the port.
       */
      openLanguageSettings: Platform.OS === 'ios' ? () => Linking.openSettings() : null,
    },
    secureStore: {
      async getDatabaseKey() {
        const stored = await SecureStore.getItemAsync(DATABASE_KEY)
        if (stored === null) return null
        return hexToBytes(stored)
      },
      async setDatabaseKey(key) {
        await SecureStore.setItemAsync(DATABASE_KEY, bytesToHex(key))
      },
    },
  }),
)
