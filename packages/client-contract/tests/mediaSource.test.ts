import {
  createFakeMediaSource,
  friendsWithAttachments,
  solo,
  type StagedHead,
} from '@session/client/fake'
import jpeg from 'jpeg-js'
import { describe, expect, it } from 'vitest'

import { MAX_STAGED_READ_BYTES, runMediaSourceContract, type MediaSourceHarness } from '#src/index'

function grey(width: number, height: number): Uint8Array {
  return jpeg.encode({ width, height, data: new Uint8Array(width * height * 4).fill(0x80) }, 90)
    .data
}

// Real JPEGs, since a thumbnail is checked by its frame header. The original is neither square nor
// within the largest thumbnail edge, 1024, so a thumbnail served from it fails both shape checks.
const ORIGINAL = grey(1280, 960)
const THUMBNAIL = grey(32, 32)

const readPhoto = (fileName: string): Promise<Uint8Array> =>
  Promise.resolve(fileName.startsWith('thumbnail-') ? THUMBNAIL : ORIGINAL)

const PNG = Uint8Array.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR', (c) => c.charCodeAt(0))
const PDF = Uint8Array.from('%PDF-1.7\n', (c) => c.charCodeAt(0))

const STAGED: ReadonlyMap<string, Uint8Array> = new Map([
  ['/home/alice/Pictures/\u00e9t\u00e9 \u65e5\u672c.jpg', ORIGINAL],
  ['/home/alice/Pictures/scan.png', PNG],
  ['/home/alice/Documents/paper.pdf', PDF],
])

// There, but what the desktop and mobile readers refuse on opening.
const NOT_REGULAR = ['/home/alice/Pictures', '/home/alice/Pictures/fifo.jpg']

// A picture past the largest staged file read, by its size alone, as a sparse file would be.
const OVERSIZED = '/home/alice/Pictures/panorama.jpg'

const readStaged = (path: string, count: number): Promise<StagedHead> => {
  if (path === OVERSIZED) {
    return Promise.resolve({ head: ORIGINAL.subarray(0, count), size: MAX_STAGED_READ_BYTES + 1 })
  }
  const bytes = STAGED.get(path)
  return bytes === undefined
    ? Promise.reject(new Error('ENOENT'))
    : Promise.resolve({ head: bytes.subarray(0, count), size: bytes.length })
}

const harness: MediaSourceHarness = {
  withAttachments() {
    const { world, clients } = friendsWithAttachments(['Alice', 'Bob'], { sets: ['pictures'] })
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const recipient = world.account('Alice')
    const sender = world.account('Bob')
    const conversationId = sender.sessionId
    const album = recipient.messages(conversationId).find((m) => m.attachments.length > 0)
    const png = album?.attachments.find((a) => a.contentType === 'image/png')
    if (!album || !png?.hasThumbhash) throw new Error('fixture did not seed a hashed PNG')
    const unhashed = recipient.deliverFrom(sender, 'No hash', world.now(), [
      { ...png, index: 0, hasThumbhash: false },
      {
        ...png,
        index: 1,
        contentType: 'application/pdf',
        filename: 'paper.pdf',
        hasThumbhash: false,
      },
      { ...png, index: 2, contentType: 'image/avif', filename: 'scan.avif', hasThumbhash: false },
      { ...png, index: 3, filename: 'original.png', originalFile: true },
    ])
    world.settle()
    return Promise.resolve({
      source: createFakeMediaSource(alice, readPhoto, readStaged),
      client: alice,
      conversationId,
      picture: { messageId: album.id, index: png.index },
      unhashed: { messageId: unhashed.id, index: 0 },
      document: { messageId: unhashed.id, index: 1 },
      avif: { messageId: unhashed.id, index: 2 },
      original: { messageId: unhashed.id, index: 3 },
      settle: () => {
        world.settle()
        return Promise.resolve()
      },
    })
  },

  empty() {
    const { clients } = solo('Alice')
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    return Promise.resolve({ source: createFakeMediaSource(alice, readPhoto, readStaged) })
  },

  staged() {
    const { clients } = solo('Alice')
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const [jpeg = '', png = '', document = ''] = STAGED.keys()
    return Promise.resolve({
      source: createFakeMediaSource(alice, readPhoto, readStaged),
      client: alice,
      jpeg,
      png,
      document,
      missing: '/home/alice/Pictures/gone.jpg',
      oversized: OVERSIZED,
      notRegular: NOT_REGULAR,
    })
  },
}

describe('fake', () => {
  runMediaSourceContract(harness, { describe, it, expect })
})
