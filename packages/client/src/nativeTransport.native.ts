import { createSessionBridge } from '@session/bridge-rn'

import type { BridgeTransport } from './types'
import type { NativeTransportOptions } from './nativeTransport.types'

export type { NativeTransportOptions }

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
    netid: options.netid ?? '',
    deviceType: options.deviceType ?? '',
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
