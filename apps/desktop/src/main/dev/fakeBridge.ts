import type { BridgeTransport } from '@session/client'
import { createFakeTransport, crowd, friends, newcomer } from '@session/client/fake'

/**
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
export function createFakeBridge(): BridgeTransport {
  // A conversation list big enough to measure, when something asks for one. The default stays the
  // two-account fixture, so nothing about the ordinary dev loop changes.
  const peers = Number(process.env['SESSION_FAKE_CONVERSATIONS'] ?? '0')
  // No identity yet, which is the only way to reach onboarding: everywhere else the app sees an
  // account and goes straight past it. The name mobile reads, so one variable does this on both.
  const fresh = process.env['EXPO_PUBLIC_SESSION_NO_ACCOUNT'] === '1'
  const { world, clients } = fresh
    ? newcomer()
    : peers > 0
      ? crowd({ peers, history: Number(process.env['SESSION_FAKE_HISTORY'] ?? '1') })
      : friends(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  // The fake's clock is manual so tests can decide when a send lands. Running the app there
  // is nobody to advance it, so let it tick.
  const ticking = setInterval(() => {
    world.settle()
  }, 50)
  ticking.unref?.()

  // A start that refuses, which is otherwise only reachable with a database somebody has already
  // broken. The failure screen is the one screen nobody sees by accident, so there has to be a way
  // to open it on purpose -- the message is libsession's own words for the failure that produced
  // it, so the screen looks the way it does in the wild rather than the way a placeholder does.
  if (process.env['SESSION_FAKE_FAILED_START'] === '1') {
    alice.getAccountInfo = () =>
      Promise.reject(new Error('getConversations: Invalid conversation id: not a hex session ID'))
  }

  return createFakeTransport(alice)
}
