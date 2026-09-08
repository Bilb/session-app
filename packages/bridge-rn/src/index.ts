import { NitroModules } from 'react-native-nitro-modules'

import type { NativeFrame, SessionBridge as Spec } from './SessionBridge.nitro'

export type { NativeFrame, NativeRequest } from './SessionBridge.nitro'

/**
 * The spec plus `setSink`, which the C++ registers itself (see HybridSessionBridge::setSink).
 *
 * `setSink` before `init`: libsession publishes the state it already has while the Client is
 * being constructed, so a sink installed afterwards has already missed the first frames, and
 * `init` refuses to run without one.
 */
export type SessionBridge = Spec & {
  setSink(onFrame: (frame: NativeFrame) => void): void
}

/**
 * The HybridObject, created on demand.
 *
 * Not created at module scope: importing this file is not the same as wanting a database open,
 * and the app decides when that happens - after it has resolved the key, which it cannot do
 * synchronously.
 */
export function createSessionBridge(): SessionBridge {
  return NitroModules.createHybridObject<Spec>('SessionBridge') as SessionBridge
}
