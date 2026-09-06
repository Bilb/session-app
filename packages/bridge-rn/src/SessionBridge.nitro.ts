import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Everything the bridge needs to open a Client, and nothing it can work out for itself.
 *
 * `NativeTransportOptions` in @session/client is where this shape is documented and where callers
 * meet it. It is written out again here because nitrogen generates the C++ struct from this
 * declaration and cannot follow an import out of the package; `nativeTransport.native.ts` — the
 * one file allowed to see both — asserts that the two still agree.
 *
 * `deferAccount` is required here and optional there on purpose: the default belongs to the
 * caller-facing type, and making it optional here would only put a second one in the shim.
 */
export interface SessionBridgeOptions {
  dbPath: string
  cacheDir: string
  rawKeyHex?: string
  password?: string
  deferAccount: boolean
}

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
