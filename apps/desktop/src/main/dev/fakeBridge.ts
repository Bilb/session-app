import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { AttachmentRef, BridgeTransport } from '@session/client'
import {
  createFakeTransport,
  fakePreviewPixels,
  photoFileName,
  startDevFake,
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
 * The bridge, backed by the fake.
 *
 * This is a dev entry and lives here so the boundary rules can say so: production code
 * never imports the fake, and the dynamic import in ../bridge.ts is what keeps it out of a
 * shipped bundle.
 */
export function createFakeBridge(): BridgeTransport & MediaSource {
  const { alice, served } = startDevFake(process.env, {
    has: (fileName) => existsSync(join(MEDIA_DIR, fileName)),
    where: `in ${MEDIA_DIR}`,
    fix: 'pnpm fake-media:fetch',
  })

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
