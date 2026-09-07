import type { BridgeTransport, Frame, Request } from '@session/client'

/**
 * The renderer's whole view of libsession: frames in, requests out, in order, over the one
 * MessagePort the preload hands into this world.
 *
 * The port arrives a moment after the page starts, so both directions are buffered until it does.
 * Dropping a request sent in that window would strand the app on its loading screen - the first
 * thing it asks for is the account, and nothing else happens until that comes back.
 */
export function createPortTransport(): BridgeTransport {
  let port: MessagePort | null = null
  let onFrame: ((frame: Frame) => void) | null = null
  const queuedRequests: Request[] = []
  const queuedFrames: Frame[] = []

  function deliver(frame: Frame): void {
    if (onFrame) onFrame(frame)
    else queuedFrames.push(frame)
  }

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.data !== 'session-bridge-port') return
    const received = event.ports[0]
    if (!received) return

    port = received
    port.onmessage = (message: MessageEvent<Frame>) => {
      deliver(message.data)
    }
    port.start()

    for (const request of queuedRequests.splice(0, queuedRequests.length)) {
      port.postMessage(request)
    }
  })

  return {
    send(request: Request): void {
      if (port) port.postMessage(request)
      else queuedRequests.push(request)
    },

    setSink(handler: (frame: Frame) => void): void {
      onFrame = handler
      for (const frame of queuedFrames.splice(0, queuedFrames.length)) handler(frame)
    },

    close(): void {
      port?.close()
      port = null
      onFrame = null
    },
  }
}
