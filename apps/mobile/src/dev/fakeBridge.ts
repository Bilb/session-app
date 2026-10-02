import { requirePorts, setPorts } from '@session/app'
import type { BridgeTransport } from '@session/client'
import {
  createFakeTransport,
  driveFakeClock,
  photoFileNames,
  pickFakeFixture,
  type FakeDevEnv,
  type FakeSessionClient,
} from '@session/client/fake'
import { Directory, File, Paths } from 'expo-file-system'

import { fakeExportSource, fakeMediaPort } from './fakeMedia'

function fileUrl(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * The fake's export, plus the file it stands for.
 *
 * The fake has no disk, and on mobile the export is not finished when libsession answers: the
 * files port still has to hand the file to the photo library or a folder, which needs one there.
 */
function writingExports(client: FakeSessionClient, photos: ReadonlyMap<string, string>): void {
  const exportAttachment = client.exportAttachment.bind(client)
  client.exportAttachment = async (messageId, index, destination, options) => {
    const landed = await exportAttachment(messageId, index, destination, options)
    const source = fakeExportSource(client, { messageId, index }, photos)
    const target = new File(fileUrl(landed))
    if ('photo' in source) new File(source.photo).copySync(target)
    else target.write(source.text)
    return landed
  }
}

/**
 * The dev photographs, by file name, from the app's own storage.
 *
 * The folder desktop reads, copied onto the device by `pnpm --filter @session/mobile
 * fake-media:push`, since the app cannot read the host's disk. Refuses to start without every one
 * of them and names the commands that fix it: a fake that drew something else would look like it
 * works and hide whether the pictures that would really arrive are drawn right.
 */
function pushedPhotos(): Map<string, string> {
  const folder = new Directory(Paths.document, 'fake-media')
  const photos = new Map<string, string>()
  if (folder.exists) {
    for (const entry of folder.list()) {
      if (entry instanceof File) photos.set(entry.name, entry.uri)
    }
  }
  const missing = photoFileNames().filter((name) => !photos.has(name))
  if (missing.length > 0) {
    throw new Error(
      `The fake needs its dev photographs on the device, and ${String(missing.length)} are ` +
        'missing. Run: pnpm fake-media:fetch && pnpm --filter @session/mobile fake-media:push',
    )
  }
  return photos
}

/**
 * The bridge, backed by the fake - the same arrangement the desktop app uses, so both
 * platforms show the same seeded conversations while the real bridge is being built.
 *
 * Every variable is spelled out: Expo inlines `process.env.EXPO_PUBLIC_*` only where the name is
 * written literally. They are the same names desktop reads.
 */
export function createFakeBridge(): BridgeTransport {
  const photos = pushedPhotos()
  const env: FakeDevEnv = {
    EXPO_PUBLIC_SESSION_FAKE_FIXTURE: process.env['EXPO_PUBLIC_SESSION_FAKE_FIXTURE'],
    EXPO_PUBLIC_SESSION_NO_ACCOUNT: process.env['EXPO_PUBLIC_SESSION_NO_ACCOUNT'],
    EXPO_PUBLIC_SESSION_FAKE_CROWD_PEERS: process.env['EXPO_PUBLIC_SESSION_FAKE_CROWD_PEERS'],
    EXPO_PUBLIC_SESSION_FAKE_CROWD_HISTORY: process.env['EXPO_PUBLIC_SESSION_FAKE_CROWD_HISTORY'],
  }
  const { world, clients } = pickFakeFixture(env)
  const alice = clients['Alice']
  if (!alice) throw new Error('the fixture did not produce a client')

  driveFakeClock(world, process.env['EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN'])

  writingExports(alice, photos)
  // Installed here rather than in platform.ts, so that no production module imports the fake.
  setPorts({ ...requirePorts(), media: fakeMediaPort(alice, photos) })

  return createFakeTransport(alice)
}
