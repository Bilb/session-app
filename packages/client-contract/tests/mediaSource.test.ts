import { createFakeMediaSource, friendsWithAttachments, solo } from '@session/client/fake'
import { describe, expect, it } from 'vitest'

import { runMediaSourceContract, type MediaSourceHarness } from '#src/index'

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

const readPhoto = (): Promise<Uint8Array> => Promise.resolve(JPEG)

const harness: MediaSourceHarness = {
  withAttachments() {
    const { world, clients } = friendsWithAttachments(['Alice', 'Bob'], { sets: ['files'] })
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const conversationId = world.account('Bob').sessionId
    const message = world
      .account('Alice')
      .messages(conversationId)
      .find((m) => m.attachments.length === 2)
    if (!message) throw new Error('fixture did not seed a picture beside a file')
    return Promise.resolve({
      source: createFakeMediaSource(alice, readPhoto),
      client: alice,
      conversationId,
      picture: { messageId: message.id, index: 0 },
      unhashed: { messageId: message.id, index: 1 },
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
    return Promise.resolve({ source: createFakeMediaSource(alice, readPhoto) })
  },
}

describe('fake', () => {
  runMediaSourceContract(harness, { describe, it, expect })
})
