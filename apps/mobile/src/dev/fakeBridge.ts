import { serveNativeMediaFrom, type BridgeTransport } from '@session/client'
import {
  createFakeMediaSource,
  createFakeTransport,
  startDevFake,
  type FakeDevEnv,
  type FakeSessionClient,
} from '@session/client/fake'
import { Directory, File, Paths } from 'expo-file-system'

import { fakeExportSource } from './fakeMedia'

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
 * The dev photographs, by file name, from the app's own storage: the folder desktop reads, copied
 * onto the device by `pnpm --filter @session/mobile fake-media:push`, since the app cannot read the
 * host's disk.
 */
function pushedPhotos(): Map<string, string> {
  const folder = new Directory(Paths.document, 'fake-media')
  const photos = new Map<string, string>()
  if (folder.exists) {
    for (const entry of folder.list()) {
      if (entry instanceof File) photos.set(entry.name, entry.uri)
    }
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
    EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN: process.env['EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN'],
    // TODO: a Developer Settings switch that fails the next launch, once that screen exists, so a
    // build without this variable can reach the failure screen too.
    EXPO_PUBLIC_SESSION_FAKE_FAILED_START: process.env['EXPO_PUBLIC_SESSION_FAKE_FAILED_START'],
  }
  const { alice, served } = startDevFake(env, {
    has: (fileName) => photos.has(fileName),
    where: 'on the device',
    fix: 'pnpm fake-media:fetch && pnpm --filter @session/mobile fake-media:push',
  })

  writingExports(alice, photos)
  // Through the real loaders: the port is platform.ts's, and only the bytes are the fake's.
  serveNativeMediaFrom(
    createFakeMediaSource(alice, async (photo) => {
      const uri = photos.get(photo)
      if (uri === undefined) throw new Error(`no dev photograph ${photo}`)
      return new Uint8Array(await new File(uri).arrayBuffer())
    }),
  )

  return createFakeTransport(served)
}
