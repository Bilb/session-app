import type { NetworkName } from '@session/basic-types'
import * as Crypto from 'expo-crypto'
import { documentDirectory, makeDirectoryAsync } from 'expo-file-system/legacy'
import * as SecureStore from 'expo-secure-store'

const KEY = 'session.db.key'

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is the app's. A
 * random 32 bytes at first launch, kept in the OS keychain - which is the entire reason there
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
 * Where the database and the attachment cache live, both created if they are not there.
 *
 * Split by network, so a devnet identity and a mainnet one can both exist and switching back
 * loses neither. libsession derives its own snode cache from the database's directory, which puts
 * that on the right side of the split too - a cache of nodes that do not exist on the other
 * network is worse than none.
 */
export async function sessionPaths(
  network: NetworkName,
): Promise<{ dbPath: string; cacheDir: string }> {
  const root = `${documentDirectory ?? ''}session/${network}`
  await makeDirectoryAsync(root, { intermediates: true })
  const cacheDir = `${root}/attachments`
  await makeDirectoryAsync(cacheDir, { intermediates: true })

  // libsession takes filesystem paths, not URLs, and expo-file-system speaks the latter.
  const strip = (path: string): string => path.replace(/^file:\/\//, '')
  return { dbPath: `${strip(root)}/session.db`, cacheDir: strip(cacheDir) }
}
