import { memoryPorts, setPorts } from '@s2/app'
import * as SecureStore from 'expo-secure-store'

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
 * Only the secure store is real so far — it is the one the walking skeleton needs, because
 * libsession takes a database key and does not keep one. The rest are the memory
 * implementations until the screens that use them arrive.
 */
setPorts(
  memoryPorts({
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
