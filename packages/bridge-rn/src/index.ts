import { NitroModules } from 'react-native-nitro-modules'

import type { SessionBridge, SessionBridgeOptions } from './SessionBridge.nitro'

export type { SessionBridge, SessionBridgeOptions }

/**
 * The HybridObject, created on demand.
 *
 * Not created at module scope: importing this file is not the same as wanting a database open,
 * and the app decides when that happens — after it has resolved the key, which it cannot do
 * synchronously.
 */
export function createSessionBridge(): SessionBridge {
  return NitroModules.createHybridObject<SessionBridge>('SessionBridge')
}
