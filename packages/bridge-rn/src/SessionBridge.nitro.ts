import type { HybridObject } from 'react-native-nitro-modules'
import type { SessionBridgeOptions } from '@session/bridge-types'

/**
 * The bridge, as JSI sees it.
 *
 * Three methods and one callback — the same surface the N-API addon exposes, because both are
 * transports in front of the same shim and neither is allowed an opinion of its own.
 *
 * `setSink` before `init`: libsession publishes the state it already has while the Client is
 * being constructed, so a sink installed afterwards has already missed the first frames.
 */
export interface SessionBridge extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  setSink(onFrame: (frame: ArrayBuffer) => void): void
  init(options: SessionBridgeOptions): void
  call(request: ArrayBuffer): void
  close(): void
}
