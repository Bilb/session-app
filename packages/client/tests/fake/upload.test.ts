import type { SessionEvent } from '@session/client'
import { describe, expect, it } from 'vitest'

import { friends } from '#src/fake/fixtures'

type Progress = Extract<SessionEvent, { type: 'attachment-progress' }>

async function sendTwo() {
  const { world, clients } = friends(['Alice', 'Bob'])
  const alice = clients['Alice']
  if (!alice) throw new Error('no Alice')
  const bobId = world.account('Bob').sessionId
  world.writeFile('/tmp/first.pdf', 60_000)
  world.writeFile('/tmp/second.txt', 2_000)
  const events: SessionEvent[] = []
  alice.onEvent((event) => events.push(event))
  const messageId = await alice.sendMessage(bobId, {
    body: '',
    attachments: [{ path: '/tmp/first.pdf' }, { path: '/tmp/second.txt' }],
  })
  const uploads = () =>
    events.filter((e): e is Progress => e.type === 'attachment-progress' && e.transfer === 'upload')
  return { world, alice, bobId, messageId, uploads }
}

describe('the uploads of a send in the fake', () => {
  it('report each file as libsession does: 0 of 0, then bytes, then one outcome', async () => {
    const { world, messageId, uploads } = await sendTwo()
    // Nothing before the send has answered.
    expect(uploads()).toEqual([])
    world.settle()

    for (const index of [0, 1]) {
      const own = uploads().filter((e) => e.index === index)
      expect(own.every((e) => e.messageId === messageId)).toBe(true)
      expect(own[0]).toMatchObject({ doneBytes: 0, totalBytes: 0 })
      expect(own[0]?.outcome).toBeUndefined()
      const last = own.at(-1)
      expect(last?.outcome).toEqual({ ok: true })
      expect(last?.doneBytes).toBe(last?.totalBytes)
      expect(own.filter((e) => e.outcome !== undefined)).toHaveLength(1)
      const done = own.map((e) => e.doneBytes)
      expect(done).toEqual([...done].sort((a, b) => a - b))
    }
    // One at a time, in index order: the second starts once the first has ended.
    const reports = uploads()
    const firstEnd = reports.findIndex((e) => e.index === 0 && e.outcome !== undefined)
    const secondStart = reports.findIndex((e) => e.index === 1)
    expect(firstEnd).toBeLessThan(secondStart)
  })

  it('stops reporting at a restart, and a retry reports only the files not up', async () => {
    const { world, alice, bobId, messageId } = await sendTwo()
    // Into the first file's upload and no further.
    world.advance(20)
    const restarted = alice.restart()
    const events: SessionEvent[] = []
    restarted.onEvent((event) => events.push(event))
    const reports = () =>
      events.filter(
        (e): e is Progress => e.type === 'attachment-progress' && e.transfer === 'upload',
      )

    world.settle()
    expect(reports()).toEqual([])
    const failed = (await restarted.getMessages(bobId)).messages.find((m) => m.id === messageId)
    expect(failed?.sendState).toBe('failed')

    expect(await restarted.retrySend(messageId)).toBe(true)
    world.settle()
    expect(
      reports()
        .filter((e) => e.outcome !== undefined)
        .map((e) => [e.index, e.outcome?.ok]),
    ).toEqual([
      [0, true],
      [1, true],
    ])
  })
})
