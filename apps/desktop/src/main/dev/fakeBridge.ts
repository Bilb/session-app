import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { AttachmentRef, BridgeTransport } from '@session/client'
import {
  createFakeTransport,
  driveFakeClock,
  fakePreviewPixels,
  photoFileName,
  photoFileNames,
  pickFakeFixture,
  unopenable,
} from '@session/client/fake'

import type { MediaSource } from '../media'

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

  // A database that will not open, which is otherwise only reachable with one somebody has already
  // broken. The failure screen is the one screen nobody sees by accident, so there has to be a way
  // to open it on purpose. `unopenable` refuses as the real bridge does, with libsession's own
  // reason, and lets a discard through -- so the screen's Clear Device works here too.
  const served =
    process.env['SESSION_FAKE_FAILED_START'] === '1'
      ? unopenable(alice, 'file is not a database')
      : alice

  return {
    ...createFakeTransport(served),
    async fetchMedia(ref: AttachmentRef) {
      // Through the same door a tap uses. Serving this scheme *is* a fetch: the real bridge
      // fills the cache and libsession announces the availability change, so a fake that handed
      // bytes back without either would leave every picture it just drew still reported as one
      // nobody has. Cheap to repeat - a cached attachment answers at once.
      await alice.downloadAttachment(ref.messageId, ref.index)
      const photo = photoFileName(alice, ref)
      if (photo === null) throw new Error('not a picture')
      // A video is served its still: nothing here plays one, and a photograph is a still.
      return { contentType: 'image/jpeg', bytes: await readFile(join(MEDIA_DIR, photo)) }
    },

    fetchPreview(ref: AttachmentRef) {
      return Promise.resolve(fakePreviewPixels(alice, ref))
    },
  }
}
