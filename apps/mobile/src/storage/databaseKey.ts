import { keyInvalid, keyMissing, keyUnavailable } from '@session/client'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

/**
 * The keychain item's name, which must not be one in `RETIRED_KEYS`: the keychain never changes an
 * existing item's accessibility on update, so only a new item gets the attribute in `OPTIONS`.
 */
const KEY = 'session.db.key.this-device'

/**
 * Names older builds stored the key under, with an accessibility that lets it into backups.
 * Deleted, never read: a key that may have been in a backup must not open anything.
 */
const RETIRED_KEYS = ['session.db.key', 'session2.database-key']

/**
 * **`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, as the legacy client keeps every keychain item.** After
 * first unlock, because a message arriving on a locked phone has to be written to the database.
 * This device only, so the key never leaves it: a backup restored to another phone carries a
 * database it cannot open. iOS only; Android's store wraps it with a Keystore key, which never
 * leaves the device anyway.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** The stored key, as hex, or null before there is one. */
export function readDatabaseKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY, OPTIONS)
}

/** Stores the key, as hex. */
export function writeDatabaseKey(hex: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, hex, OPTIONS)
}

/** What the bridge takes: 32 bytes as 64 hex characters. */
const HEX_KEY = /^[0-9a-f]{64}$/i

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A new random key, stored, as hex. */
async function mintDatabaseKey(): Promise<string> {
  const bytes = Crypto.getRandomBytes(32)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  await writeDatabaseKey(hex)
  return hex
}

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is the app's. A random
 * 32 bytes at first launch, kept in the OS keychain - which is the entire reason there is a
 * secure-storage port at all.
 *
 * **A key is made only when there is none and no database either.** An Android Keystore key that
 * has been invalidated reads as no key at all -- expo-secure-store deletes the item and answers
 * null -- so a missing key beside a database is that, and minting would make the database
 * unreadable for good. It is thrown as `KEY_MISSING` instead, and clearing past it is the person's
 * choice on the startup-failure screen. A read that throws is a keychain that will not answer now
 * (iOS before the first unlock), and is `KEY_UNAVAILABLE`.
 *
 * `databaseExists` asks about every network's database, since one key opens them all.
 */
export async function resolveDatabaseKey(databaseExists: () => boolean): Promise<string> {
  let existing: string | null
  try {
    existing = await readDatabaseKey()
  } catch (error) {
    throw keyUnavailable(describe(error))
  }
  if (existing !== null) {
    if (!HEX_KEY.test(existing)) {
      throw keyInvalid(`${String(existing.length)} characters, not 64 hex digits`)
    }
    return existing
  }
  if (databaseExists()) throw keyMissing()

  // A true first launch, so whatever an older build stored has nothing left to open.
  await Promise.all(RETIRED_KEYS.map((key) => SecureStore.deleteItemAsync(key)))
  return mintDatabaseKey()
}

/**
 * Writes a new key over whatever is stored. Only for the clear past a key failure, once every
 * database the old key opened is gone: see `discardDatabases`.
 */
export async function replaceDatabaseKey(): Promise<void> {
  await mintDatabaseKey()
}
