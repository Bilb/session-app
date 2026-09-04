import { createSessionClient, type BridgeTransport } from '@session/client'
import { createSessionStore } from '@session/state'

/**
 * The mobile client.
 *
 * The Nitro module will provide the transport; until it exists the fake is loaded through a
 * dynamic import so that it stays out of a release bundle, exactly as it does on desktop.
 */
async function openTransport(): Promise<BridgeTransport> {
  if (process.env['SESSION_FAKE'] === '1' || __DEV__) {
    const { createFakeBridge } = await import('./dev/fakeBridge')
    return createFakeBridge()
  }

  throw new Error(
    'No libsession bridge available yet. Run with SESSION_FAKE=1 until the Nitro module is built.',
  )
}

export const storePromise = openTransport().then((transport) =>
  createSessionStore(createSessionClient(transport)),
)
