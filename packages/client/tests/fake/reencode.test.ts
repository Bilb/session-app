import { describe, expect, it } from 'vitest'

import { friends } from '#src/fake/fixtures'

async function send(files: { path: string; contentType: string }[]) {
  const { world, clients } = friends(['Alice', 'Bob'])
  const alice = clients['Alice']
  if (!alice) throw new Error('no Alice')
  alice.readStagedFilesWith({ decodesHeic: true })
  const bobId = world.account('Bob').sessionId
  for (const { path } of files) world.writeFile(path, 2_000)
  const messageId = await alice.sendMessage(bobId, { body: '', attachments: files })
  const message = async () =>
    (await alice.getMessages(bobId)).messages.find((m) => m.id === messageId)
  return { world, alice, messageId, message }
}

describe('a picture the fake re-encodes to send', () => {
  it('is renamed and retyped as libsession re-encodes it', async () => {
    const { world, message } = await send([
      { path: '/tmp/a.heic', contentType: 'image/heic' },
      { path: '/tmp/b.png', contentType: 'image/png' },
    ])
    world.settle()
    const sent = await message()
    expect(sent?.attachments.map((a) => [a.contentType, a.filename])).toEqual([
      ['image/jpeg', 'a.jpg'],
      ['image/webp', 'b.webp'],
    ])
  })

  it('turns a set into a gallery once converting its HEIC makes it viewable', async () => {
    const { world, message } = await send([
      { path: '/tmp/a.jpg', contentType: 'image/jpeg' },
      { path: '/tmp/b.heic', contentType: 'image/heic' },
    ])
    expect((await message())?.galleryViewable).toBe(false)
    expect((await message())?.gallery).toBe(false)
    world.settle()
    expect((await message())?.galleryViewable).toBe(true)
    expect((await message())?.gallery).toBe(true)
  })

  it('keeps a list chosen for a set that was viewable before it was converted', async () => {
    const { world, alice, messageId, message } = await send([
      { path: '/tmp/a.jpg', contentType: 'image/jpeg' },
      { path: '/tmp/b.png', contentType: 'image/png' },
    ])
    expect(await alice.setGallery(messageId, false)).toBe(true)
    world.settle()
    expect((await message())?.attachments.every((a) => a.uploaded)).toBe(true)
    expect((await message())?.gallery).toBe(false)
  })
})
