import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

import { keyInvalid, keyMissing, keyUnavailable } from '@session/client'

/** The parts of Electron's `safeStorage` the key needs, so a test can stand in for the keyring. */
export interface KeySealer {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

const KEY_FILE = 'db-key.bin'
const KEY_BYTES = 32

/** What the bridge is opened with in `dir`, and so what a discard there has to remove. */
export function databasePaths(dir: string): { dbPath: string; cacheDir: string } {
  return { dbPath: join(dir, 'session.db'), cacheDir: join(dir, 'attachments') }
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string') return code
  return error instanceof Error ? error.message : String(error)
}

/**
 * The database key for `dir`.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is ours. A random
 * 32 bytes at first boot, sealed with safeStorage and kept beside the database. The renderer
 * never sees it: it lives in the main process, which is also the only process that can load
 * the addon.
 *
 * **A key is made only when there is no key file and no database.** Anything else that goes wrong
 * is thrown as a `DatabaseKeyError` and nothing is written: a keychain that is locked today, or a
 * keyring that is not running, opens the database again tomorrow, and a key written over the old
 * one never does. Clearing past one of these is the person's choice, made on the startup-failure
 * screen: see `replaceDatabase`.
 *
 * safeStorage degrades to plaintext where there is no keyring - a bare Linux session, most
 * often - and says so. Encrypting anyway would be a claim we cannot keep; the fallback that
 * belongs here is the argon2id password path the bridge already supports, which needs a
 * screen to ask on and so waits for onboarding.
 */
export function resolveDatabaseKey(dir: string, sealer: KeySealer): Uint8Array {
  let stored: Buffer
  try {
    stored = readFileSync(join(dir, KEY_FILE))
  } catch (error) {
    const code = errorCode(error)
    if (code !== 'ENOENT') throw keyUnavailable(`${KEY_FILE} could not be read (${code})`)
    if (existsSync(databasePaths(dir).dbPath)) throw keyMissing()
    return mintDatabaseKey(dir, sealer)
  }

  if (!sealer.isEncryptionAvailable()) {
    // Written in plaintext where there was no keyring, so exactly the key's length. Anything else
    // was sealed by a keyring that is not there now, and may be again.
    if (stored.length !== KEY_BYTES) {
      throw keyUnavailable(
        `safeStorage is unavailable, and ${KEY_FILE} was sealed with it (${String(stored.length)} bytes)`,
      )
    }
    return new Uint8Array(stored)
  }

  let encoded: string
  try {
    encoded = sealer.decryptString(stored)
  } catch (error) {
    throw keyUnavailable(`safeStorage could not unseal ${KEY_FILE} (${errorCode(error)})`)
  }
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== KEY_BYTES) {
    throw keyInvalid(`${String(key.length)} bytes, not ${String(KEY_BYTES)}`)
  }
  return new Uint8Array(key)
}

/**
 * Writes a new key for `dir`. `wx`, so it refuses to write over a key that is there: the one way a
 * key is lost is by being replaced.
 */
function mintDatabaseKey(dir: string, sealer: KeySealer): Uint8Array {
  const key = randomBytes(KEY_BYTES)
  writeFileSync(
    join(dir, KEY_FILE),
    sealer.isEncryptionAvailable() ? sealer.encryptString(key.toString('base64')) : key,
    { mode: 0o600, flag: 'wx' },
  )
  return new Uint8Array(key)
}

/**
 * The clear for a database whose key could not be had: deletes what the bridge's own discard
 * deletes -- the database, its -wal and -shm, and the attachment cache, keeping the service-node
 * cache beside them -- then the key, and makes a new one.
 *
 * Only ever run from a discard, which only a confirmed Clear Device sends. Every removal tolerates
 * a file already gone, so a clear that failed part way can be pressed again.
 */
export function replaceDatabase(dir: string, sealer: KeySealer): void {
  const { dbPath, cacheDir } = databasePaths(dir)
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, cacheDir]) {
    rmSync(path, { recursive: true, force: true })
  }
  rmSync(join(dir, KEY_FILE), { recursive: true, force: true })
  mintDatabaseKey(dir, sealer)
}
