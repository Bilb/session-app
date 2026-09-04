import type { BridgeTransport } from '@s2/client'
import { createFakeTransport, friends } from '@s2/client/fake'

/**
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
export function createFakeBridge(): BridgeTransport {
  const { world, clients } = friends(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  // The fake's clock is manual so tests can decide when a send lands. Running the app there
  // is nobody to advance it, so let it tick.
  const ticking = setInterval(() => {
    world.settle()
  }, 50)
  ticking.unref?.()

  return createFakeTransport(alice)
}
