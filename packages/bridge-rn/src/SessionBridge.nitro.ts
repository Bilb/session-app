import type { CustomType, HybridObject } from 'react-native-nitro-modules'
import type { SessionBridgeOptions } from '@session/bridge-types'

/**
 * The protocol types as nitrogen sees them: an opaque brand standing for a C++ type it does not
 * generate. `Frame` and `Request` are TypeScript unions, and nitrogen's CustomType distributes over
 * a union and then fails to read its own marker, so the spec names the C++ type and points at the
 * header that converts it; the one adapter that calls this casts the brand to the real type.
 *
 * Fully qualified with a leading `::`, because nitrogen puts the spec in
 * `margelo::nitro::session::bridge::rn`, where a bare `session_bridge` would be looked up inside
 * that namespace first. `canBePassedByReference` keeps the struct from being copied once more on
 * its way to the dispatcher.
 */
export type NativeFrame = CustomType<
  { readonly __frame?: never },
  '::session_bridge::Frame',
  { include: 'session_bridge/gen/jsi.hpp'; canBePassedByReference: true }
>
export type NativeRequest = CustomType<
  { readonly __request?: never },
  '::session_bridge::Request',
  { include: 'session_bridge/gen/jsi.hpp'; canBePassedByReference: true }
>

/**
 * The bridge, as nitrogen sees it.
 *
 * The same surface the N-API addon exposes, because both are transports in front of the same
 * shim and neither is allowed an opinion of its own - minus `setSink`, which
 * `HybridSessionBridge` registers by hand as a raw JSI method. Nitro's typed callback wrapper
 * copies every argument once before the hop to the JS thread, and the frame is the one thing
 * this module exists not to copy; `index.ts` puts the method back on the exported type.
 */
export interface SessionBridge extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  init(options: SessionBridgeOptions): void
  call(request: NativeRequest): void
  close(): void
}
