import { appLog, logStoreMilestones, startLogger } from '@session/app'
import {
  createLogger,
  LogWriter,
  Pseudonyms,
  type LogDirectory,
  type LogLevel,
} from '@session/logging'
import type { SessionStore } from '@session/state'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import { AppState, Platform } from 'react-native'

const SALT_FILE = '.salt'
const SALT_BYTES = 16

/**
 * The zero of the uptime column and the name of this launch's file: when this bundle started
 * running, the nearest thing to the process starting that JavaScript can see.
 *
 * Measured here rather than taken as `performance.now()` alone, because React Native's clock
 * counts from the device booting, not from the app starting.
 */
const launchMs = Date.now()
const launchPerfMs = performance.now()
const uptimeMs = (): number => performance.now() - launchPerfMs

/**
 * The log directory through expo-file-system's synchronous calls.
 *
 * Synchronous because each is one bridge call that returns at once, and a write that has been
 * handed over cannot then be lost to the app being suspended before an awaited one resolved.
 */
function expoDirectory(dir: Directory): LogDirectory {
  return {
    list: () =>
      Promise.resolve(
        dir
          .list()
          .filter((entry): entry is File => entry instanceof File)
          .map((file) => ({ name: file.name, sizeBytes: file.size })),
      ),
    append: (name, text) => {
      const file = new File(dir, name)
      if (!file.exists) file.create()
      file.write(text, { append: true })
      return Promise.resolve()
    },
    remove: (name) => {
      const file = new File(dir, name)
      if (file.exists) file.delete()
      return Promise.resolve()
    },
    read: (name) => new File(dir, name).text(),
  }
}

/**
 * The pseudonym key, made on first use and kept beside the logs but never exported with them.
 * See `readSalt` in the desktop's main process for why it is not in the keychain.
 */
function readSalt(dir: Directory): Uint8Array {
  const file = new File(dir, SALT_FILE)
  if (file.exists) {
    const hex = file.textSync().trim()
    if (/^[0-9a-f]{32,}$/.test(hex)) {
      return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
    }
  }
  const salt = Crypto.getRandomBytes(SALT_BYTES)
  if (!file.exists) file.create()
  file.write([...salt].map((byte) => byte.toString(16).padStart(2, '0')).join(''))
  return salt
}

/** `iOS 26.1`, or `Android 16 (API 36)`: Android's version number alone hides the API level. */
function osName(): string {
  if (Platform.OS === 'android') {
    const release = (Platform.constants as { Release?: string }).Release ?? 'unknown'
    return `Android ${release} (API ${String(Platform.Version)})`
  }
  return `${Platform.OS === 'ios' ? 'iOS' : Platform.OS} ${String(Platform.Version)}`
}

/**
 * The model, where React Native knows it. Android reports it; iOS does not without a native
 * module, so it says which kind of device and admits the rest.
 */
function model(): string {
  if (Platform.OS === 'android') {
    const constants = Platform.constants as { Manufacturer?: string; Model?: string }
    return [constants.Manufacturer, constants.Model].filter(Boolean).join(' ') || 'unknown'
  }
  return `${Platform.OS === 'ios' && Platform.isPad ? 'iPad' : 'iPhone'} (model unknown)`
}

/**
 * The logs: documents/`logs`, a new file for this launch, and the lifecycle markers.
 *
 * Opened at import, before the bridge, so the first line of a run is the app starting rather than
 * whatever the bridge had to say. A directory that cannot be opened leaves the console as the
 * only place lines go, which is said there.
 */
const opened = (async (): Promise<LogWriter> => {
  const dir = new Directory(Paths.document, 'logs')
  if (!dir.exists) dir.create({ intermediates: true })
  const salt = readSalt(dir)
  const writer = await LogWriter.open(expoDirectory(dir), {
    launchMs,
    onError: (error) => {
      console.error('[logs] a write failed:', error)
    },
  })
  const logger = createLogger({
    sink: writer,
    pseudonyms: new Pseudonyms(salt),
    uptimeMs,
    minLevel: (category) => (category === 'session' ? 'debug' : 'info'),
  })
  startLogger(logger, {
    launchedAtMs: launchMs,
    model: model(),
    os: osName(),
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    install: 'unknown',
    platformRows: [],
    // The same variables, literally named, that store.ts opens the bridge with.
    network: {
      fake: process.env['EXPO_PUBLIC_SESSION_FAKE'] === '1',
      netid: process.env['EXPO_PUBLIC_SESSION_NETID'],
      router: process.env['EXPO_PUBLIC_SESSION_ROUTER'],
      devnetSeedUrl: process.env['EXPO_PUBLIC_SESSION_DEVNET_SEED_URL'],
      fileServerUrl: process.env['EXPO_PUBLIC_SESSION_FILE_SERVER_URL'],
      logSpec: process.env['EXPO_PUBLIC_SESSION_LOG'],
    },
    previousRun: writer.previousRun,
  })

  // Backgrounding is the last thing a suspended app is told, so its marker is what lets the next
  // launch say whether this one ended or died; the flush is what gets it onto disk in time.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') appLog.marker('lifecycle', 'foreground')
    if (state === 'background') {
      appLog.marker('lifecycle', 'background')
      void writer.flush()
    }
  })
  // The OS is about to start killing things to get memory back; this one may be next, and a log
  // that ends after this line says why.
  AppState.addEventListener('memoryWarning', () => {
    appLog.marker('lifecycle', 'memory warning')
  })
  return writer
})()

opened.catch((error: unknown) => {
  console.error('[logs] could not open the log directory:', error)
})

/** The store's milestones as markers, once there is a store. */
export function watchStore(store: SessionStore): void {
  logStoreMilestones(store)
}

/** The store's `log` option: every line to the file, and to the console in development. */
export function storeLog(level: LogLevel, category: string, message: string, op?: string): void {
  appLog.log(level, category, message, undefined, op)
  if (__DEV__) {
    const method = level === 'critical' ? 'error' : level === 'trace' ? 'debug' : level
    // Reaches logcat as ReactNativeJS on Android, and the device console on iOS.
    console[method](`[${category}] ${message}`)
  }
}
