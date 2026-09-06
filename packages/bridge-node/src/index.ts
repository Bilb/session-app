import { createRequire } from 'node:module'

import type { BridgeTransport } from '@session/client'
import type { SessionBridgeOptions } from '@session/bridge-types'

/**
 * The shared open options, minus the one the addon takes differently.
 *
 * N-API hands a Uint8Array straight to C++, so there is no reason to make the main process
 * hex-encode a key for a call inside its own process — that is the only field that differs from
 * what the Nitro bridge is given.
 */
export interface NodeBridgeOptions extends Omit<SessionBridgeOptions, 'rawKeyHex'> {
  /**
   * The 32-byte database key. libsession accepts one but neither derives nor stores it, which
   * is why the app has a secure-storage port at all: generate once at first boot, keep it in
   * the OS keyring, and never let it reach the renderer.
   */
  rawKey?: Uint8Array
  /** Overrides where the addon is loaded from. `SESSION_BRIDGE_ADDON` does the same. */
  addonPath?: string
}

interface NativeBridge {
  call(request: Uint8Array): void
  close(): void
}

interface Addon {
  SessionBridge: new (
    options: Omit<NodeBridgeOptions, 'addonPath'>,
    onFrame: (frame: Uint8Array) => void,
  ) => NativeBridge
}

const require = createRequire(import.meta.url)

function loadAddon(explicitPath: string | undefined): Addon {
  // Resolved rather than imported, so a bundler cannot try to follow it: the addon is a
  // platform binary that has to be found at runtime wherever the app was installed.
  const path =
    explicitPath ??
    process.env['SESSION_BRIDGE_ADDON'] ??
    require.resolve('@session/bridge-node/addon')
  return require(path) as Addon
}

/**
 * The bridge, backed by the real libsession.
 *
 * Runs in the Electron main process: Core owns its own threads, so nothing here blocks, and the
 * main process already owns the things the bridge needs — the key in safeStorage, the user data
 * directory, and the shutdown that has to close the database. The renderer never sees this, only
 * the frames it produces.
 */
export function createNodeBridgeTransport(options: NodeBridgeOptions): BridgeTransport {
  const { addonPath, ...init } = options
  const { SessionBridge } = loadAddon(addonPath)

  // Frames produced between construction and setSink would otherwise be dropped: libsession
  // publishes the initial state as the Client is built, which is before any caller can have
  // subscribed. Buffering is the same handshake the preload does for the same reason.
  let sink: ((frame: Uint8Array) => void) | null = null
  const pending: Uint8Array[] = []

  const bridge = new SessionBridge(init, (frame) => {
    if (sink) sink(frame)
    else pending.push(frame)
  })

  let closed = false

  return {
    send(request: Uint8Array): void {
      if (!closed) bridge.call(request)
    },

    setSink(onFrame: (frame: Uint8Array) => void): void {
      sink = onFrame
      const buffered = pending.splice(0, pending.length)
      for (const frame of buffered) onFrame(frame)
    },

    close(): void {
      if (closed) return
      closed = true
      sink = null
      bridge.close()
    },
  }
}
