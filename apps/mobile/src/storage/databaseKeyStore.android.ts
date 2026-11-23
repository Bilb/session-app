import { requireNativeModule } from 'expo'
import * as SecureStore from 'expo-secure-store'

/** `modules/database-key`: the key sealed with an Android Keystore key, in no-backup storage. */
const DatabaseKey = requireNativeModule<{
  read(): Promise<string | null>
  write(hex: string): Promise<void>
}>('DatabaseKey')

/**
 * Android: the native store, which the push service also reads, with no JavaScript running, to
 * handle a push that starts the app cold. iOS keeps the keychain (`databaseKeyStore.ts`).
 */
export function readDatabaseKey(): Promise<string | null> {
  return DatabaseKey.read()
}

export function writeDatabaseKey(hex: string): Promise<void> {
  return DatabaseKey.write(hex)
}

/**
 * Removes what older builds stored, on a true first launch: the key used to be kept by
 * expo-secure-store, under these names. Not read, so nothing is carried over.
 */
export async function retireOldKeys(): Promise<void> {
  await Promise.all(
    ['session.db.key.this-device', 'session.db.key', 'session2.database-key'].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  )
}
