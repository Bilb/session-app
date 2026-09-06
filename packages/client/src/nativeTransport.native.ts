import { createSessionBridge } from '@session/bridge-rn'

import type { SessionBridgeOptions } from '@session/bridge-rn'
import type { BridgeTransport } from './types'
import type { NativeTransportOptions } from './nativeTransport.types'

export type { NativeTransportOptions }

/**
 * The two declarations of the options are the same shape, and this is what keeps them that way.
 *
 * They cannot be one declaration: nitrogen generates the C++ struct from the interface written in
 * `SessionBridge.nitro.ts`, and the boundary rules leave this file as the only one that may see
 * that package. A field added on either side without the other now fails typecheck here rather
 * than reaching the bridge as undefined.
 *
 * Compared with the optionality stripped, because the one difference is deliberate: see the
 * interface in `SessionBridge.nitro.ts`.
 */
type Assert<T extends true> = T
type Match<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export type _OptionsMatchTheNitroStruct = Assert<
  Match<Required<NativeTransportOptions>, Required<SessionBridgeOptions>>
>

/**
 * The bridge, backed by the real libsession, over JSI.
 *
 * The one place the Nitro module is linked — the boundary rules say so, and the reason is that
 * everything above a BridgeTransport is meant to be unable to tell which one it has.
 */
export function createNativeBridgeTransport(options: NativeTransportOptions): BridgeTransport {
  const bridge = createSessionBridge()

  // Frames produced while the Client is being constructed would otherwise be dropped:
  // libsession publishes the state it already has before init() returns, which is before any
  // caller can have subscribed.
  let sink: ((frame: Uint8Array) => void) | null = null
  const pending: Uint8Array[] = []

  bridge.setSink((frame: ArrayBuffer) => {
    const bytes = new Uint8Array(frame)
    if (sink) sink(bytes)
    else pending.push(bytes)
  })

  bridge.init({
    dbPath: options.dbPath,
    cacheDir: options.cacheDir,
    ...(options.rawKeyHex === undefined ? {} : { rawKeyHex: options.rawKeyHex }),
    ...(options.password === undefined ? {} : { password: options.password }),
    deferAccount: options.deferAccount ?? false,
  })

  let closed = false

  return {
    send(request: Uint8Array): void {
      if (closed) return
      // A copy, because the buffer a caller hands over is theirs to reuse and JSI reads it
      // on the other side of the call.
      const copy = new Uint8Array(request)
      bridge.call(copy.buffer as ArrayBuffer)
    },

    setSink(onFrame: (frame: Uint8Array) => void): void {
      sink = onFrame
      for (const frame of pending.splice(0, pending.length)) onFrame(frame)
    },

    close(): void {
      if (closed) return
      closed = true
      sink = null
      bridge.close()
    },
  }
}
