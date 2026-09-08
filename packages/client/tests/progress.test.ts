import type { AttachmentProgress, Frame, Request } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { createSessionClient } from '#src/createSessionClient'
import type { BridgeTransport } from '#src/types'

/**
 * Progress routing, which has no fake behind it: the fake world has no attachments, so the only
 * way to exercise the registration's lifetime is to drive the frames by hand.
 */
function harness(): {
  client: ReturnType<typeof createSessionClient>
  sent: Request[]
  emit: (frame: Frame) => void
} {
  const sent: Request[] = []
  let sink: ((frame: Frame) => void) | undefined

  const transport: BridgeTransport = {
    send: (request) => sent.push(request),
    setSink: (onFrame) => {
      sink = onFrame
    },
    close: () => undefined,
  }

  return {
    client: createSessionClient(transport),
    sent,
    emit: (frame) => {
      if (!sink) throw new Error('the client never installed a sink')
      sink(frame)
    },
  }
}

function report(requestId: number, index: number, result?: number): Frame {
  const progress: AttachmentProgress = {
    messageId: 1,
    index,
    done: 1,
    total: 1,
    ...(result === undefined ? {} : { result }),
  }
  return { type: 'event', event: { type: 'attachment-progress', requestId, progress } }
}

describe('attachment progress', () => {
  it('keeps routing until every attachment the send asked for has settled', async () => {
    const { client, sent, emit } = harness()
    const seen: number[] = []

    const sending = client.sendMessage(
      '05aa',
      { body: 'hi', attachments: [{ path: '/a' }, { path: '/b' }] },
      { onUploadProgress: (p) => seen.push(p.index) },
    )
    const id = sent[0]?.id
    if (id === undefined) throw new Error('the command was never sent')

    // The first file finishes before the second has said anything at all. Retiring on what has
    // reported so far would drop everything the second one goes on to send.
    emit(report(id, 0, 0))
    emit(report(id, 1))
    emit(report(id, 1, 0))
    expect(seen).toEqual([0, 1, 1])

    // Both have settled now, so the registration is gone and a late report goes nowhere.
    emit(report(id, 0, 0))
    expect(seen).toEqual([0, 1, 1])

    emit({ type: 'response', response: { id, result: { type: 'messageId', messageId: 7 } } })
    await expect(sending).resolves.toBe(7)
  })

  it('broadcasts a transfer libsession started on its own', async () => {
    const { client, emit } = harness()
    const events: string[] = []
    client.onEvent((event) => events.push(event.type))

    emit({
      type: 'event',
      event: {
        type: 'attachment-progress',
        conversationId: '05aa',
        progress: { messageId: 1, index: 0, done: 0, total: 0 },
      },
    })

    expect(events).toEqual(['attachment-progress'])
    await Promise.resolve()
  })
})
