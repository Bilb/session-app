import { describe, expect, it } from 'vitest'

import { createFakeMediaSource } from '#src/fake/media'
import { friendsWithAttachments, showcase } from '#src/fake/index'

const readPhoto = (name: string): Promise<Uint8Array> =>
  Promise.resolve(new TextEncoder().encode(name))

async function showcasePhoto() {
  const { world, clients } = showcase()
  const alice = clients['Alice']
  if (!alice) throw new Error('no Alice')
  const { messages } = await alice.getMessages(world.account('Bob').sessionId, { limit: 100 })
  const photo = messages
    .flatMap((m) => m.attachments.map((attachment) => ({ messageId: m.id, attachment })))
    .find((l) => l.attachment.filename?.startsWith('unsplash-01'))
  if (!photo) throw new Error('no photograph in the showcase')
  return { alice, world, ref: { messageId: photo.messageId, index: photo.attachment.index } }
}

describe('the fake media source', () => {
  it('answers a picture only once its transfer has finished, so its placeholder shows meanwhile', async () => {
    const { alice, world, ref } = await showcasePhoto()
    let answered = false
    const media = createFakeMediaSource(alice, readPhoto)
      .fetchMedia(ref)
      .then((m) => {
        answered = true
        return m
      })
    await Promise.resolve()
    expect(answered).toBe(false)
    world.settle()
    expect(new TextDecoder().decode((await media).bytes)).toBe('unsplash-01.jpg')
    expect(alice.isCached(ref)).toBe(true)
  })

  it('serves every picture as a real photograph, whatever its name', async () => {
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
    const source = createFakeMediaSource(alice, readPhoto)
    const served = pictures.map((ref) => source.fetchMedia(ref))
    world.settle()
    for (const media of await Promise.all(served)) {
      expect(new TextDecoder().decode(media.bytes)).toMatch(/^unsplash-\d{2}\.jpg$/)
    }
  })

  it("answers a placeholder decoded from the photograph's real hash", async () => {
    const { alice, ref } = await showcasePhoto()
    const preview = await createFakeMediaSource(alice, readPhoto).fetchPreview(ref)
    // The photographs are 4:3, decoded at 32x24.
    expect(preview).toMatchObject({ width: 32, height: 24 })
    expect(preview.rgba.length).toBe(32 * 24 * 4)
  })
})
