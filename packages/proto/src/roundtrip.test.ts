import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import { describe, expect, it } from 'vitest'

import { ConversationKind, FrameSchema, RequestSchema } from './index'

describe('wire format', () => {
  it('carries a send command there and back', () => {
    const request = create(RequestSchema, {
      id: 7,
      cmd: {
        case: 'sendMessage',
        value: {
          conversationId: '05abc',
          body: 'hello',
          attachments: [{ path: '/tmp/cat.jpg', contentType: 'image/jpeg' }],
        },
      },
    })

    const decoded = fromBinary(RequestSchema, toBinary(RequestSchema, request))

    expect(decoded.id).toBe(7)
    expect(decoded.cmd.case).toBe('sendMessage')
    if (decoded.cmd.case !== 'sendMessage') throw new Error('unreachable')
    expect(decoded.cmd.value.body).toBe('hello')
    expect(decoded.cmd.value.attachments[0]?.path).toBe('/tmp/cat.jpg')
  })

  it('carries an event frame with a whole conversation', () => {
    const frame = create(FrameSchema, {
      kind: {
        case: 'event',
        value: {
          kind: {
            case: 'conversationUpdated',
            value: {
              conversation: {
                id: '05abc',
                kind: ConversationKind.DM,
                displayName: 'Alice',
                lastActivity: 1_700_000_000_000n,
                unreadCount: 2,
              },
            },
          },
        },
      },
    })

    const decoded = fromBinary(FrameSchema, toBinary(FrameSchema, frame))

    expect(decoded.kind.case).toBe('event')
    if (decoded.kind.case !== 'event') throw new Error('unreachable')
    const event = decoded.kind.value
    if (event.kind.case !== 'conversationUpdated') throw new Error('unreachable')
    expect(event.kind.value.conversation?.displayName).toBe('Alice')
    expect(event.kind.value.conversation?.lastActivity).toBe(1_700_000_000_000n)
  })

  it('tells "still going" apart from "accepted" on a response', () => {
    // A progress report with no result is under way; result 0 is the only "done".
    const underway = create(FrameSchema, {
      kind: {
        case: 'event',
        value: {
          kind: {
            case: 'attachmentProgress',
            value: { messageId: 1n, index: 0, done: 0n, total: 0n },
          },
        },
      },
    })

    const decoded = fromBinary(FrameSchema, toBinary(FrameSchema, underway))
    if (decoded.kind.case !== 'event') throw new Error('unreachable')
    const event = decoded.kind.value
    if (event.kind.case !== 'attachmentProgress') throw new Error('unreachable')
    expect(event.kind.value.result).toBeUndefined()
  })
})
