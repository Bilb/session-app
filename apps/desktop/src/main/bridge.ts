import type { BridgeTransport } from '@s2/client'

/**
 * Opens the bridge the renderer talks to.
 *
 * Only the fake exists today. It is reached through a dynamic import from a dev-only
 * module, so a production build has no path to it at all; when the addon lands it is
 * loaded here instead and nothing above this file changes, because the renderer only ever
 * sees frames.
 */
export async function createBridge(): Promise<BridgeTransport> {
  if (process.env['SESSION_FAKE'] === '1') {
    const { createFakeBridge } = await import('./dev/fakeBridge')
    return createFakeBridge()
  }

  throw new Error(
    'No libsession bridge available yet. Run with SESSION_FAKE=1 until the addon is built.',
  )
}
