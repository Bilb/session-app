import type { BridgeTransport } from '@s2/client'
import { createFakeTransport, friends } from '@s2/client/fake'

/**
 * The bridge, backed by the fake — the same arrangement the desktop app uses, so both
 * platforms show the same seeded conversations while the real bridge is being built.
 */
export function createFakeBridge(): BridgeTransport {
  const { world, clients } = friends(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  setInterval(() => {
    world.settle()
  }, 50)

  return createFakeTransport(alice)
}
