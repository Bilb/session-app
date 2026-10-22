import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'

/** What seals the key at rest: Electron's safeStorage, or a stand-in in tests. */
export interface KeySealer {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(sealed: Buffer): string
}

const KEY_BYTES = 32

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is ours. A random
 * 32 bytes at first boot, sealed with safeStorage and kept beside the database. The renderer
 * never sees it: it lives in the main process, which is also the only process that can load
 * the addon.
 *
 * safeStorage degrades to plaintext where there is no keyring - a bare Linux session, most
 * often - and says so. Encrypting anyway would be a claim we cannot keep; the fallback that
 * belongs here is the argon2id password path the bridge already supports, which needs a
 * screen to ask on and so waits for onboarding.
 *
 * **Never replaces a key once a database exists.** One that cannot be read throws instead, and
 * the bridge reports it as a start failure: a new key would make the database unreadable for
 * good, while the old one may only be waiting for a keyring to come back.
 */
export function resolveDatabaseKey(dir: string, dbPath: string, sealer: KeySealer): Uint8Array {
  const keyFile = join(dir, 'db-key.bin')
  if (existsSync(keyFile)) return openKey(readFileSync(keyFile), sealer)
  if (existsSync(dbPath))
    throw new Error(
      'The database key is missing beside an existing database, which no new key could open. Nothing was changed.',
    )

  const key = randomBytes(KEY_BYTES)
  writeDurably(
    keyFile,
    sealer.isEncryptionAvailable() ? sealer.encryptString(key.toString('base64')) : key,
  )
  return new Uint8Array(key)
}

/**
 * A stored key, told apart by its length rather than by whether a keyring is available now,
 * since that can differ from when it was written: a plain key is exactly 32 bytes, and every
 * platform's sealed form is longer.
 */
function openKey(stored: Buffer, sealer: KeySealer): Uint8Array {
  if (stored.length === KEY_BYTES) return new Uint8Array(stored)
  if (!sealer.isEncryptionAvailable())
    throw new Error(
      'The database key is sealed, and this session has no keyring to open it. Nothing was changed.',
    )
  let key: Buffer
  try {
    key = Buffer.from(sealer.decryptString(stored), 'base64')
  } catch (e) {
    throw new Error(
      `The database key could not be unsealed (${e instanceof Error ? e.message : String(e)}). Nothing was changed.`,
      { cause: e },
    )
  }
  if (key.length !== KEY_BYTES)
    throw new Error(
      `The database key unsealed to ${String(key.length)} bytes rather than ${String(KEY_BYTES)}. Nothing was changed.`,
    )
  return new Uint8Array(key)
}

/**
 * Written beside the target and renamed over it, flushed first: the database is created right
 * after, so a key lost to a crash here would leave a database nothing can open.
 */
function writeDurably(file: string, data: Uint8Array): void {
  const temp = `${file}.tmp`
  const fd = openSync(temp, 'w', 0o600)
  try {
    writeSync(fd, data)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temp, file)
  try {
    const dirFd = openSync(dirname(file), 'r')
    try {
      fsyncSync(dirFd)
    } finally {
      closeSync(dirFd)
    }
  } catch {
    // Windows cannot open a directory to flush it; NTFS journals the rename itself.
  }
}
