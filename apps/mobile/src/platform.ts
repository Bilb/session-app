import { memoryPorts, setPorts } from '@session/app'
import * as Clipboard from 'expo-clipboard'
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
 * Real where a screen has arrived that needs it, and a memory implementation everywhere else.
 *
 * The clipboard is real now because settings shows the account ID, and an account ID nobody can
 * copy is one they have to read out loud. Until this it was the memory port, so Copy wrote to a
 * variable and the system clipboard never heard about it - the button worked on desktop and did
 * nothing at all on either phone.
 */
setPorts(
  memoryPorts({
    // The literal the transport is given lives in store.ts; this is the same answer, said where a
    // screen can reach it. Both move together when devnet lands.
    network: { name: 'mainnet' },
    clipboard: {
      setString: (value) => Clipboard.setStringAsync(value).then(() => undefined),
      getString: () => Clipboard.getStringAsync(),
    },
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
