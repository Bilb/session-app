import { createSessionBridge } from '@session/bridge-rn'

import type { NativeFrame, NativeRequest } from '@session/bridge-rn'
import type { Frame, Request, SessionBridgeOptions } from '@session/bridge-types'

import type { BridgeTransport } from './types'

/**
 * The bridge, backed by the real libsession, over JSI.
 *
 * The one place the Nitro module is linked - the boundary rules say so, and the reason is that
 * everything above a BridgeTransport is meant to be unable to tell which one it has.
 *
 * The two casts are the whole cost of nitrogen not being able to name a union: the spec carries
 * opaque brands and the C++ behind them builds and reads exactly these types.
 */
export function createNativeBridgeTransport(options: SessionBridgeOptions): BridgeTransport {
  const bridge = createSessionBridge()

  // Frames produced while the Client is being constructed would otherwise be dropped:
  // libsession publishes the state it already has before init() returns, which is before any
  // caller can have subscribed.
  let sink: ((frame: Frame) => void) | null = null
  const pending: Frame[] = []

  bridge.setSink((frame: NativeFrame) => {
    const typed = frame as unknown as Frame
    if (sink) sink(typed)
    else pending.push(typed)
  })

  bridge.init(options)

  let closed = false

  return {
    send(request: Request): void {
      if (closed) return
      bridge.call(request as unknown as NativeRequest)
    },

    setSink(onFrame: (frame: Frame) => void): void {
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
