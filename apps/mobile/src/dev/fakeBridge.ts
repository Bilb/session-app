import type { BridgeTransport } from '@session/client'
import {
  createFakeTransport,
  friendsWithAttachments,
  newcomer,
  unopenable,
} from '@session/client/fake'

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

  // A database that will not open, as the desktop's `SESSION_FAKE_FAILED_START` does: the failure
  // screen is otherwise reachable only with one somebody has already broken. `unopenable` refuses
  // as the real bridge does, with libsession's own reason, and lets a discard through -- so the
  // screen's Clear Device works here too.
  //
  // TODO: a Developer Settings switch that fails the next launch, once that screen exists, so a
  // build without this variable can reach it too.
  const served =
    process.env['EXPO_PUBLIC_SESSION_FAKE_FAILED_START'] === '1'
      ? unopenable(alice, 'file is not a database')
      : alice

  return createFakeTransport(served)
}
