import type { BridgeTransport } from '@session/client'
import { createFakeTransport, friends, newcomer } from '@session/client/fake'

/**
 * The bridge, backed by the fake - the same arrangement the desktop app uses, so both
 * platforms show the same seeded conversations while the real bridge is being built.
 */
export function createFakeBridge(): BridgeTransport {
  // No identity yet, which is the only way to reach onboarding: everywhere else the app sees an
  // account and goes straight past it. The desktop fake has had this; mobile needs it for the same
  // reason, and mobile is where most of the onboarding screens are. `EXPO_PUBLIC_` because Metro
  // inlines a variable into the bundle only when its name carries that prefix -- see store.ts.
  const fresh = process.env['EXPO_PUBLIC_SESSION_NO_ACCOUNT'] === '1'
  const { world, clients } = fresh ? newcomer() : friends(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  setInterval(() => {
    world.settle()
  }, 50)

  return createFakeTransport(alice)
}
