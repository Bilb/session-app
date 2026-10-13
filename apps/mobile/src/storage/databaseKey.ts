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

/**
 * The database key.
 *
 * libsession accepts a key but neither derives nor stores one, so custody is the app's. A random
 * 32 bytes at first launch, kept in the OS keychain - which is the entire reason there is a
 * secure-storage port at all.
 */
export async function resolveDatabaseKey(): Promise<string> {
  const existing = await readDatabaseKey()
  if (existing) return existing

  await Promise.all(RETIRED_KEYS.map((key) => SecureStore.deleteItemAsync(key)))
  const bytes = Crypto.getRandomBytes(32)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  await writeDatabaseKey(hex)
  return hex
}
