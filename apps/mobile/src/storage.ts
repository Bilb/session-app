import * as Crypto from 'expo-crypto'
import { documentDirectory, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy'
import * as SecureStore from 'expo-secure-store'

const KEY = 'session.db.key'

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is the app's. A
 * random 32 bytes at first launch, kept in the OS keychain — which is the entire reason there
 * is a secure-storage port at all.
 */
export async function resolveDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY)
  if (existing) return existing

  const bytes = Crypto.getRandomBytes(32)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  await SecureStore.setItemAsync(KEY, hex)
  return hex
}

/**
 * Whether a QA run has asked for an account to be minted without anybody tapping.
 *
 * A file rather than an environment variable because Metro inlines `process.env` at build
 * time, so a value set at launch never reaches the bundle. A file in the app's own documents
 * directory is readable at runtime, is the same mechanism on both platforms, and is put there
 * by whoever is driving the device:
 *
 *     xcrun simctl get_app_container <device> org.getsession.session2 data
 *     touch "$container/Documents/qa-auto-account"
 *
 * Development builds only — see where this is consulted.
 */
export async function qaAutoAccountRequested(): Promise<boolean> {
  try {
    const info = await getInfoAsync(`${documentDirectory ?? ''}qa-auto-account`)
    return info.exists
  } catch {
    return false
  }
}

/** Where the database and the attachment cache live, both created if they are not there. */
export async function sessionPaths(): Promise<{ dbPath: string; cacheDir: string }> {
  const root = `${documentDirectory ?? ''}session`
  await makeDirectoryAsync(root, { intermediates: true })
  const cacheDir = `${root}/attachments`
  await makeDirectoryAsync(cacheDir, { intermediates: true })

  // libsession takes filesystem paths, not URLs, and expo-file-system speaks the latter.
  const strip = (path: string): string => path.replace(/^file:\/\//, '')
  return { dbPath: `${strip(root)}/session.db`, cacheDir: strip(cacheDir) }
}
