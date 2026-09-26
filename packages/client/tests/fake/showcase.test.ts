import { describe, expect, it } from 'vitest'

import { showcase } from '#src/fake/showcase'

async function showcaseMessages() {
  const { world, clients } = showcase()
  const alice = clients['Alice']
  if (!alice) throw new Error('fixture did not produce a client')
  const { messages } = await alice.getMessages(world.account('Bob').sessionId, { limit: 100 })
  return messages
}

describe('showcase', () => {
  it('gives every picture of a message a filename of its own, past the last photo too', async () => {
    const messages = await showcaseMessages()
    const album = messages.find((m) => m.body === 'Thirty-two')
    const filenames = album?.attachments.map((a) => a.filename) ?? []
    expect(filenames.length).toBe(32)
    expect(new Set(filenames).size).toBe(32)
  })

  it('serves the expired entries of a set as notFound and the rest as absent', async () => {
    const messages = await showcaseMessages()
    const files = messages.find((m) => m.body === 'Four of these five are gone')
    expect(files?.attachments.map((a) => a.availability)).toEqual([
      'notFound',
      'notFound',
      'notFound',
      'notFound',
      'absent',
    ])
  })
})
