import { describe, expect, it } from 'vitest'

import { friends } from '#src/fake/fixtures'
import { createFakeMediaSource, type StagedHead } from '#src/fake/media'

const readPhoto = (): Promise<Uint8Array> => Promise.resolve(new Uint8Array([1]))
const readStaged = (): Promise<StagedHead> => Promise.reject(new Error('ENOENT'))

async function sendTakenBehindLent(lentType = 'text/plain') {
  const { world, clients } = friends(['Alice', 'Bob'])
  const alice = clients['Alice']
  if (!alice) throw new Error('no Alice')
  const bobId = world.account('Bob').sessionId
  world.writeFile('/tmp/lent', 2_000)
  world.writeFile('/tmp/taken.txt', 2_000)
  const messageId = await alice.sendMessage(bobId, {
    body: '',
    attachments: [
      { path: '/tmp/lent', contentType: lentType },
      { path: '/tmp/taken.txt', takeFile: true },
    ],
  })
  const message = async () =>
    (await alice.getMessages(bobId)).messages.find((m) => m.id === messageId)
  return { world, alice, messageId, message }
}

describe('a file the fake took for a send', () => {
  it('is no longer served once a lent file gone before its upload leaves the send unsendable', async () => {
    const { world, alice, messageId, message } = await sendTakenBehindLent()
    expect((await message())?.attachments[1]?.availability).toBe('cached')
    world.removeFile('/tmp/lent')
    world.settle()

    expect((await message())?.sendState).toBe('unsendable')
    expect((await message())?.attachments[1]?.availability).toBe('absent')
    await expect(
      createFakeMediaSource(alice, readPhoto, readStaged).fetchMedia({ messageId, index: 1 }),
    ).rejects.toThrow('is not downloaded')
  })
})

describe('a picture the fake sends as the original file', () => {
  it('is flagged when its upload starts, not when the message is stored', async () => {
    const { world, message } = await sendTakenBehindLent('image/bmp')
    expect((await message())?.attachments[0]?.originalFile).toBe(false)
    world.settle()
    expect((await message())?.attachments.map((a) => a.originalFile)).toEqual([true, false])
  })
})
