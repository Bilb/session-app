import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { BridgeTransport, MediaSource } from '@session/client'
import {
  createFakeMediaSource,
  createFakeTransport,
  driveFakeClock,
  photoFileNames,
  pickFakeFixture,
} from '@session/client/fake'

/**
 * The folder of dev photographs the fake serves, filled by `pnpm fake-media:fetch`.
 *
 * Outside the repository on purpose: several megabytes of somebody else's photographs are not
 * something to commit. Unprefixed because it is a path on the host, read only by host processes -
 * this one, the fetch script and mobile's push script - and never by an app bundle.
 */
const MEDIA_DIR =
  process.env['SESSION_FAKE_MEDIA_DIR'] ?? join(homedir(), '.cache', 'session-app', 'dev-media')

/**
 * Refuses to start without every photograph, naming the command that fetches them.
 *
 * Loud rather than a stand-in, because a fake that draws something else looks like it works and
 * hides whether the pictures that would really arrive are drawn right.
 */
function requirePhotos(): void {
  const missing = photoFileNames().filter((name) => !existsSync(join(MEDIA_DIR, name)))
  if (missing.length === 0) return
  throw new Error(
    `The fake needs its dev photographs in ${MEDIA_DIR}, and ${String(missing.length)} are ` +
      `missing. Run: pnpm fake-media:fetch`,
  )
}

/**
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
export function createFakeBridge(): BridgeTransport & MediaSource {
  // Before anything else, so nothing opens halfway.
  requirePhotos()

  const { world, clients } = pickFakeFixture(process.env)
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  driveFakeClock(world, process.env['EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN'])

  // A start that refuses, which is otherwise only reachable with a database somebody has already
  // broken. The failure screen is the one screen nobody sees by accident, so there has to be a way
  // to open it on purpose -- the message is libsession's own words for the failure that produced
  // it, so the screen looks the way it does in the wild rather than the way a placeholder does.
  if (process.env['SESSION_FAKE_FAILED_START'] === '1') {
    alice.getAccountInfo = () =>
      Promise.reject(new Error('getConversations: Invalid conversation id: not a hex session ID'))
  }

  return {
    ...createFakeTransport(alice),
    ...createFakeMediaSource(alice, (photo) => readFile(join(MEDIA_DIR, photo))),
  }
}
