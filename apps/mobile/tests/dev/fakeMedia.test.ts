import {
  friendsWithAttachments,
  photoFileName,
  photoFileNames,
  showcase,
} from '@session/client/fake'
import { describe, expect, it, vi } from 'vitest'

import { encodePng, fakeMediaPort, NOT_YET } from '#src/dev/fakeMedia'

// A real inflater rather than one written here, which would only agree with the encoder.
async function inflate(zlib: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([Uint8Array.from(zlib)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The IDAT payload, inflated: one filter byte then RGBA per row. */
function flat(width: number, height: number, [r, g, b]: [number, number, number]) {
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i += 1) rgba.set([r, g, b, 255], i * 4)
  return encodePng({ width, height, rgba })
}

function pixels(png: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(png.buffer, png.byteOffset)
  let at = 8
  while (at < png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    if (type === 'IDAT') return inflate(png.subarray(at + 8, at + 8 + length))
    at += 12 + length
  }
  throw new Error('no IDAT')
}

describe('the fake PNG encoder', () => {
  it('is a PNG a real inflater reads back to the colour it was given', async () => {
    const png = flat(2, 1, [10, 20, 30])
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect([...(await pixels(png))]).toEqual([0, 10, 20, 30, 255, 10, 20, 30, 255])
  })

  it('spans more than one stored block when it has to', async () => {
    // 200x100 RGBA is 80,100 raw bytes, past the 65,535 one stored block holds.
    const raw = await pixels(flat(200, 100, [1, 2, 3]))
    expect(raw.length).toBe(100 * (200 * 4 + 1))
    expect([...raw.subarray(raw.length - 4)]).toEqual([1, 2, 3, 255])
  })
})

describe('the fake media port', () => {
  async function setup() {
    const { world, clients } = showcase()
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const { messages } = await alice.getMessages(world.account('Bob').sessionId, { limit: 100 })
    const located = messages.flatMap((message) =>
      message.attachments.map((attachment) => ({ messageId: message.id, attachment })),
    )
    return { alice, located, world }
  }

  const PHOTOS = new Map(photoFileNames().map((name) => [name, `file:///fake-media/${name}`]))

  it('starts the download once per attachment, however often a screen asks', async () => {
    const { alice, located } = await setup()
    vi.useFakeTimers()
    const download = vi.spyOn(alice, 'downloadAttachment').mockResolvedValue()
    const port = fakeMediaPort(alice, PHOTOS)
    const [first] = located
    if (!first) throw new Error('no attachment')
    const ref = { messageId: first.messageId, index: first.attachment.index }
    port.urlFor(ref)
    port.urlFor(ref)
    port.urlFor(ref)
    await vi.runAllTimersAsync()
    expect(download).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('hands a picture over only once its transfer has finished', async () => {
    const { alice, located, world } = await setup()
    const photo = located.find((l) => l.attachment.filename?.startsWith('unsplash-01'))
    if (!photo) throw new Error('no photograph in the showcase')
    const ref = { messageId: photo.messageId, index: photo.attachment.index }
    const port = fakeMediaPort(alice, PHOTOS)
    // Before the bytes are in, a URL that cannot decode, so the tile keeps its placeholder.
    expect(port.urlFor(ref)).toBe(NOT_YET)
    const downloading = alice.downloadAttachment(ref.messageId, ref.index)
    world.settle()
    await downloading
    expect(port.urlFor(ref)).toBe('file:///fake-media/unsplash-01.jpg')
  })

  it('draws every picture as a real photograph, whatever its name', async () => {
    const { clients, world } = friendsWithAttachments(['Alice', 'Bob'])
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const { messages } = await alice.getMessages(world.account('Bob').sessionId, { limit: 100 })
    const pictures = messages.flatMap((message) =>
      message.attachments
        .filter((a) => a.contentType?.startsWith('image/') === true)
        .map((a) => ({ messageId: message.id, index: a.index })),
    )
    expect(pictures.length).toBeGreaterThan(0)
    for (const ref of pictures) expect(photoFileName(alice, ref)).toMatch(/^unsplash-\d{2}\.jpg$/)
  })

  it("draws a placeholder from the photograph's real hash", async () => {
    const { alice, located } = await setup()
    const photo = located.find((l) => l.attachment.filename?.startsWith('unsplash-01'))
    if (!photo) throw new Error('no photograph in the showcase')
    const preview = fakeMediaPort(alice, PHOTOS).previewUrlFor({
      messageId: photo.messageId,
      index: photo.attachment.index,
    })
    // A decoded hash is 32x24. The width is bytes 16-19 of the PNG.
    const png = Uint8Array.from(atob(preview?.split(',')[1] ?? ''), (c) => c.charCodeAt(0))
    expect(new DataView(png.buffer).getUint32(16)).toBe(32)
  })
})
