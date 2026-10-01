import type { BridgeTransport } from './types'

/**
 * A transport for a bridge that could not be made at all: every request is answered with why.
 *
 * What makes that failure reach the startup-failure screen rather than a launch screen that never
 * goes away. The app starts as usual, its first request is refused, and the store turns the
 * refusal into the screen -- the same road every other failed start takes. Nothing can be cleared
 * through it, since there is no bridge to clear with; the screen's Quit still works.
 */
export function createRefusingTransport(reason: string): BridgeTransport {
  let sink: Parameters<BridgeTransport['setSink']>[0] | null = null
  return {
    send(request) {
      // On a later turn, as a real bridge answers: a caller registers its pending entry before
      // the reply can arrive.
      void Promise.resolve().then(() => {
        sink?.({
          type: 'response',
          response: { id: request.id, error: `the bridge could not start: ${reason}` },
        })
      })
    },
    setSink(onFrame) {
      sink = onFrame
    },
    close() {
      sink = null
    },
  }
}
