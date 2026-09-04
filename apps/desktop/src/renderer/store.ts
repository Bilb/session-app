import { createSessionClient, type BridgeTransport } from '@s2/client'
import { createSessionStore } from '@s2/state'

import './platform'

/**
 * The renderer's client, built on the port the preload handed over.
 *
 * `import './platform'` above is not decoration: it installs the OS ports as a side effect,
 * and this module reads them at import time. Making it the first import is what guarantees
 * they exist by then, whatever order the bundler settles on.
 */

declare global {
  interface Window {
    sessionBridge: BridgeTransport
  }
}

const client = createSessionClient(window.sessionBridge)

export const store = createSessionStore(client)
