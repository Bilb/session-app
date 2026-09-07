import type { CustomType, HybridObject } from 'react-native-nitro-modules'
import type { SessionBridgeOptions } from '@session/bridge-types'

/**
 * The protocol types as nitrogen sees them: an opaque brand standing for a C++ type it does not
 * generate. `Frame` and `Request` are TypeScript unions, and nitrogen's CustomType distributes over
 * a union and then fails to read its own marker, so the spec names the C++ type and points at the
 * header that converts it; the one adapter that calls this casts the brand to the real type.
 *
 * Fully qualified with a leading `::`, because nitrogen puts the spec in
 * `margelo::nitro::session::bridge::rn`, where a bare `session` means something else.
 * `canBePassedByReference` keeps the struct from being copied once more on its way to the
 * dispatcher.
 */
export type NativeFrame = CustomType<
  { readonly __frame?: never },
  '::session::bridge::Frame',
  { include: 'session_bridge/gen/jsi.hpp'; canBePassedByReference: true }
>
export type NativeRequest = CustomType<
  { readonly __request?: never },
  '::session::bridge::Request',
  { include: 'session_bridge/gen/jsi.hpp'; canBePassedByReference: true }
>

/**
 * The bridge, as JSI sees it.
 *
 * Three methods and one callback - the same surface the N-API addon exposes, because both are
 * transports in front of the same shim and neither is allowed an opinion of its own.
 *
 * `setSink` before `init`: libsession publishes the state it already has while the Client is
 * being constructed, so a sink installed afterwards has already missed the first frames.
 */
export interface SessionBridge extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  setSink(onFrame: (frame: NativeFrame) => void): void
  init(options: SessionBridgeOptions): void
  call(request: NativeRequest): void
  close(): void
}
