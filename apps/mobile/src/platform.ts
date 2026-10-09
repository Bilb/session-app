import {
  memoryPorts,
  setPorts,
  type DiagnosticsSnapshot,
  type NotificationsPort,
} from '@session/app'
import { parseNetworkName } from '@session/basic-types'
import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import { Linking, Platform, Share } from 'react-native'

import { flagOverride } from './flagOverrides'
import { endingRun, logDirectory, logWriter, lowPowerRows, osName } from './logs'
import { attachmentsBytes, databaseSizes } from './storageSizes'
import { SessionLogs } from './sessionLogs'
import { restartProcess, terminateProcess } from './processExit'

/**
 * Whose servers fast mode would use, which is what the onboarding screen has to name.
 *
 * **Not derivable from `Platform.OS`.** iOS is always Apple's, but Android depends on how the
 * build was assembled: a Play build talks to Google and a Huawei build to HMS, and the catalogue
 * carries a separate description of fast mode for each. An environment variable rather than a
 * guess, for the same reason the flags are overridable -- the answer belongs to whoever assembles
 * the build, and nothing here can see it.
 *
 * Google is the Android default because it is the only one wired up so far. An unrecognised value
 * falls back rather than throwing: a typo in a build script should not stop the app starting, and
 * the screen's unqualified description is honest about a mode that is unavailable anyway.
 */
const PUSH_SERVICE: NotificationsPort['pushService'] = ((): NotificationsPort['pushService'] => {
  if (Platform.OS === 'ios') return 'apple'
  const named = process.env['EXPO_PUBLIC_SESSION_PUSH_SERVICE']
  return named === 'huawei' || named === 'google' ? named : 'google'
})()

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

/** A `file://` URI as the plain path native code and libsession take. */
function pathOf(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

/** The first or last prefixed line of a retained log file; the startup block has no time. */
function edgeLine(name: string, which: 'first' | 'last'): string | null {
  const file = new File(logDirectory, name)
  if (!file.exists) return null
  const lines = file
    .textSync()
    .split('\n')
    .filter((line) => /^\d{4}-\d{2}-\d{2}T/.test(line))
  return (which === 'first' ? lines[0] : lines.at(-1)) ?? null
}

/** Held in a const so the closures below keep its narrowing. */
const nativeLogs = SessionLogs

async function diagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const native = await SessionLogs?.diagnostics()
  return {
    install: native?.install ?? 'unknown',
    platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
    os: osName(),
    model: native?.model ?? 'unknown',
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    platformRows: lowPowerRows(native?.lowPowerMode),
    // No total: the model says how much memory the phone has.
    memory: {
      usedBytes: native?.usedBytes ?? null,
      availableBytes: native?.availableBytes ?? null,
    },
    freeBytes: native?.freeBytes ?? null,
    networkType: null,
    // What the notifications port says, which is what the app will actually do.
    notifications: 'no push service in this build',
    ...(native === undefined ? {} : { permissions: native.permissions }),
    database: databaseSizes(),
    attachmentsBytes: attachmentsBytes(),
  }
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
const ports = memoryPorts({
  // No resolver yet: React Native's image loaders take a native plug-in per platform - an
  // RCTImageURLLoader on iOS, a Fresco fetcher on Android - and neither is written. Saying so
  // draws the file form, which works, rather than an image that never loads.
  media: { urlFor: () => null, previewUrlFor: () => null },
  // The same variable and the same parser store.ts gives the transport, so the overlay cannot
  // name a network libsession never attached to. EXPO_PUBLIC_ for the reason store.ts gives.
  network: {
    // The same variable `store.ts` reads to decide which bridge to open, so the badge cannot
    // disagree with what is actually running.
    name:
      process.env['EXPO_PUBLIC_SESSION_FAKE'] === '1'
        ? 'fake'
        : parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID']),
  },
  // One literal per flag, in `flagOverrides.ts`, because a computed variable name is not a
  // variable Expo carries into the bundle at all.
  flags: { override: flagOverride },
  notifications: {
    // Both mobile operating systems stop the app when it leaves the screen, which is what makes
    // notification delivery something to choose rather than something that just happens. True on
    // a tablet as well as a phone: it is the OS that decides this, not the screen size.
    notificationModesApply: true,
    // TODO: determine this properly per build rather than declaring it false everywhere. It is a
    // fact about what was assembled -- an APNs entitlement on iOS, Play Services or HMS on
    // Android -- so it has to be answered where the build is, not guessed at here. Saying false
    // understates a build that can do it; saying true would offer a mode that silently never
    // delivers, which is the worse of the two while nothing is wired up.
    fastModeAvailable: false,
    pushService: PUSH_SERVICE,
    requestPermission: () => Promise.resolve(true),
    show: () => Promise.resolve(),
    onTap: () => () => undefined,
    setBadgeCount: () => Promise.resolve(),
  },
  build: {
    // The version app.json gives the build, which is what the stores and the OS know it as.
    version: Constants.expoConfig?.version ?? '0.0.0',
    // Inlined by Metro from what its config read out of git. See metro.config.js.
    commit: process.env['EXPO_PUBLIC_SESSION_BUILD_COMMIT'] || null,
    // What app.json gives the native build, or null where it sets none.
    buildNumber:
      Platform.OS === 'ios'
        ? (Constants.expoConfig?.ios?.buildNumber ?? null)
        : Constants.expoConfig?.android?.versionCode === undefined
          ? null
          : String(Constants.expoConfig.android.versionCode),
    // Said by whoever assembles the build, and inlined by Metro like the commit.
    variant: process.env['EXPO_PUBLIC_SESSION_BUILD_VARIANT'] || 'unknown',
    // Stamped from the submodule by metro.config.js, beside the commit.
    libsessionCommit: process.env['EXPO_PUBLIC_SESSION_LIBSESSION_COMMIT'] || null,
  },
  share: {
    // The platform's sheet, with the text alone: no title or subject, which iOS would drop and
    // Android would show as a heading above what was shared.
    shareText: (text) => Share.share({ message: text }).then(() => undefined),
  },
  clipboard: {
    setString: (value) => Clipboard.setStringAsync(value).then(() => undefined),
    // Android 13 (API 33) added the system's own preview of what was copied.
    confirmsCopy: Platform.OS === 'android' && Number(Platform.Version) >= 33,
  },
  linking: {
    // Unchanged, and repeated because a port override replaces the whole object rather than
    // merging into it. See memoryPorts.
    openUrl: (url) => Linking.openURL(url),
    /**
     * Where a permission the OS will not ask about again is turned back on.
     *
     * `openSettings()` rather than a hard-coded `app-settings:` URL, so the constant is read for
     * whichever OS version this is running on rather than hoping a literal stays correct across
     * them. Both platforms: every installed app has a settings page.
     */
    openAppSettings: () => Linking.openSettings(),
  },
  logs: {
    retained: async () => {
      const writer = await logWriter
      await writer.flush()
      return writer.files()
    },
    span: (first, last) =>
      Promise.resolve({ firstLine: edgeLine(first, 'first'), lastLine: edgeLine(last, 'last') }),
    /**
     * Compressed natively into the cache, then shared, as the legacy clients do, rather than saved
     * through a picker. expo-sharing because Android's sheet takes a file only through a content
     * provider, which it brings; on iOS it is the same activity sheet React Native's own opens.
     *
     * The sheet does not say whether anything was sent, so a closed sheet counts as delivered.
     */
    deliver:
      nativeLogs === null
        ? null
        : async (name, parts) => {
            const out = new File(Paths.cache, name)
            if (out.exists) out.delete()
            await nativeLogs.gzip(parts, pathOf(logDirectory.uri), pathOf(out.uri))
            await Sharing.shareAsync(out.uri, {
              mimeType: 'application/gzip',
              UTI: 'org.gnu.gnu-zip-archive',
            })
            return true
          },
  },
  diagnostics: { snapshot: diagnosticsSnapshot },
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
})

setPorts({
  ...ports,
  window: {
    ...ports.window,
    close: endingRun('quit', terminateProcess),
    restart: endingRun('restart', restartProcess),
  },
})
