import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

/**
 * The renderer's whole view of libsession: bytes in, bytes out, in order.
 *
 * The port arrives from the main process a moment after the page starts, so both
 * directions are buffered until it does. Dropping a request that was sent in that window
 * would strand the app on its loading screen — the first thing it asks for is the account,
 * and nothing else happens until that comes back.
 */

let port: MessagePort | null = null
let queuedRequests: Uint8Array[] = []
let queuedFrames: Uint8Array[] = []
let onFrame: ((frame: Uint8Array) => void) | null = null

function deliver(frame: Uint8Array): void {
  if (onFrame) {
    onFrame(frame)
  } else {
    queuedFrames.push(frame)
  }
}

ipcRenderer.on('session-bridge-port', (event) => {
  port = event.ports[0] ?? null
  if (!port) return

  port.onmessage = (message: MessageEvent) => {
    deliver(new Uint8Array(message.data as ArrayBufferLike))
  }
  port.start()

  const held = queuedRequests
  queuedRequests = []
  for (const request of held) port.postMessage(request)
})

contextBridge.exposeInMainWorld('sessionBridge', {
  send(request: Uint8Array): void {
    // Copied out of the renderer's heap: contextBridge hands over a proxy, and postMessage
    // needs something structured-cloneable on this side of it.
    const copy = new Uint8Array(request)
    if (port) {
      port.postMessage(copy)
    } else {
      queuedRequests.push(copy)
    }
  },

  setSink(handler: (frame: Uint8Array) => void): void {
    onFrame = handler
    const held = queuedFrames
    queuedFrames = []
    for (const frame of held) handler(frame)
  },

  close(): void {
    port?.close()
    port = null
    onFrame = null
  },
})
