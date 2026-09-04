import { createRequire } from 'node:module'

import type { BridgeTransport } from '@session/client'

export interface NodeBridgeOptions {
  /** The database file. Created if it does not exist. */
  dbPath: string
  /** Where attachment bytes are cached. */
  cacheDir: string
  /**
   * The 32-byte database key. libsession accepts one but neither derives nor stores it, which
   * is why the app has a secure-storage port at all: generate once at first boot, keep it in
   * the OS keyring, and never let it reach the renderer.
   */
  rawKey?: Uint8Array
  /** The fallback where there is no keyring to keep a key in. */
  password?: string
  /**
   * Opens without creating an account, so onboarding gets to ask. Without it libsession makes
   * one on first open and the app has decided for the user before drawing anything.
   */
  deferAccount?: boolean
  /**
   * Which network to reach: 'mainnet' or 'testnet'. Left out, the bridge never attaches one,
   * which is the whole of the offline guarantee — nothing else has to remember to check.
   *
   * Attached when an account exists, so a deferred one gets its network from createAccount.
   */
  netid?: 'mainnet' | 'testnet'
  /** What the account's other devices are told this is. */
  deviceType?: 'ios' | 'android' | 'desktop'
  /**
   * How much of libsession's own logging to forward, as `log` events.
   *
   * Worth turning on when something fails for no visible reason: the send state machine says
   * what happened and never why, and the why is in these lines.
   */
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'
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
