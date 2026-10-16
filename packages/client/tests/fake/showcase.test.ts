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

  it('holds a message of ours whose 31st of 32 files failed, with the thirty before it up', async () => {
    const messages = await showcaseMessages()
    const failed = messages.find((m) => m.body === 'File 31 of 32 failed')
    expect(failed?.outgoing).toBe(true)
    expect(failed?.sendState).toBe('failed')
    expect(failed?.attachments.filter((a) => a.uploaded)).toHaveLength(30)
    expect(failed?.attachments[30]?.uploaded).toBe(false)
  })

  it('resumes a failed send the way libsession does: the rest upload and it is sent', async () => {
    const { world, clients } = showcase()
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const bob = world.account('Bob').sessionId
    const before = (await alice.getMessages(bob, { limit: 100 })).messages
    const failed = before.find((m) => m.body === 'File 31 of 32 failed')
    const missing = before.find((m) => m.body === 'A file of this one went missing')
    if (failed === undefined || missing === undefined) throw new Error('fixture is missing a send')

    expect(await alice.retrySend(failed.id)).toBe(true)
    // A missing file fails every retry the same way, so libsession refuses one from `unsendable`.
    expect(await alice.retrySend(missing.id)).toBe(false)

    const resuming = (await alice.getMessages(bob, { limit: 100 })).messages
    expect(resuming.find((m) => m.id === failed.id)?.sendState).toBe('uploading')

    world.settle()
    const after = (await alice.getMessages(bob, { limit: 100 })).messages
    const resumed = after.find((m) => m.id === failed.id)
    expect(resumed?.sendState).toBe('sent')
    expect(resumed?.attachments.every((a) => a.uploaded)).toBe(true)
    // Each file not up before the retry reports its size once its upload does.
    expect(resumed?.attachments.every((a) => a.sizeBytes !== undefined)).toBe(true)
  })

  it('sends a failed message whose files are all up without uploading again', async () => {
    const { world, clients } = showcase()
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const bob = world.account('Bob').sessionId
    const files = (await alice.getMessages(bob, { limit: 100 })).messages.find(
      (m) => m.body === 'File 31 of 32 failed',
    )?.attachments
    if (files === undefined) throw new Error('fixture is missing a send')
    const allUp = world
      .account('Alice')
      .seedSending(bob, 'Every file up, the send failed', files, 'failed', files.length)
    world.settle()

    expect(await alice.retrySend(allUp.id)).toBe(true)
    const resuming = (await alice.getMessages(bob, { limit: 100 })).messages
    expect(resuming.find((m) => m.id === allUp.id)?.sendState).toBe('sending')
  })
})
