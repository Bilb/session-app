import type { BridgeTransport } from '@session/client'
import { createFakeTransport, friendsWithAttachments, newcomer } from '@session/client/fake'

/**
 * The bridge, backed by the fake - the same arrangement the desktop app uses, so both
 * platforms show the same seeded conversations while the real bridge is being built.
 */
export function createFakeBridge(): BridgeTransport {
  // No identity yet, which is the only way to reach onboarding: everywhere else the app sees an
  // account and goes straight past it -- and mobile is where most of the onboarding screens are.
  const fresh = process.env['EXPO_PUBLIC_SESSION_NO_ACCOUNT'] === '1'
  const { world, clients } = fresh
    ? newcomer()
    : friendsWithAttachments(['Alice', 'Bob'], { history: 4 })
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  setInterval(() => {
    world.settle()
  }, 50)

  // A start that refuses, as the desktop's `SESSION_FAKE_FAILED_START` does: the failure screen is
  // otherwise reachable only with a database somebody has already broken. The message is one
  // libsession really gives, so the screen looks the way it does in the wild.
  //
  // TODO: a Developer Settings switch that fails the next launch, once that screen exists, so a
  // build without this variable can reach it too.
  if (process.env['EXPO_PUBLIC_SESSION_FAKE_FAILED_START'] === '1') {
    alice.getAccountInfo = () =>
      Promise.reject(new Error('getConversations: Invalid conversation id: not a hex session ID'))
  }

  return createFakeTransport(alice)
}
