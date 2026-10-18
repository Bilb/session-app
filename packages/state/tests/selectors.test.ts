import type { Message, SessionEvent } from '@session/client'
import { describe, expect, it } from 'vitest'

import { applyEvent } from '#src/applyEvent'
import { selectAttachmentTransfer, selectMessage, selectMessageTransfers } from '#src/selectors'
import { emptyState, type SessionState } from '#src/types'

// The selectors behind the per-message hooks. A hook re-renders when its selector answers a new
// object, so identity is what these assert.

function message(id: number): Message {
  return {
    id,
    conversationId: '05alice',
    author: '05alice',
    timestamp: 1000 + id,
    body: `m${id}`,
    outgoing: false,
    sendState: 'sent',
    attachments: [],
    galleryViewable: false,
    gallery: false,
  }
}

function progress(messageId: number, doneBytes: number): SessionEvent {
  return {
    type: 'attachment-progress',
    transfer: 'download',
    messageId,
    index: 0,
    doneBytes,
    totalBytes: 2048,
  }
}

const loaded: SessionState = {
  ...emptyState,
  histories: {
    '05alice': {
      ready: true,
      messages: [message(1), message(2)],
      exhausted: true,
      fetching: false,
    },
  },
}

describe('selectMessageTransfers', () => {
  it('keeps a message transfers object when a report for another message lands', () => {
    const before = applyEvent(applyEvent(loaded, progress(1, 512)), progress(2, 512))
    const after = applyEvent(before, progress(2, 1024))

    expect(selectMessageTransfers(after, 1)).toBe(selectMessageTransfers(before, 1))
    expect(selectMessageTransfers(after, 2)).not.toBe(selectMessageTransfers(before, 2))
  })

  it('answers the same empty object for every message without transfers', () => {
    expect(selectMessageTransfers(loaded, 1)).toBe(selectMessageTransfers(loaded, 2))
    expect(selectMessageTransfers(loaded, 1)).toEqual({})
  })
})

describe('selectAttachmentTransfer', () => {
  it('finds a transfer by its kind and attachment', () => {
    const state = applyEvent(loaded, progress(1, 512))
    expect(selectAttachmentTransfer(state, 'download', { messageId: 1, index: 0 })?.doneBytes).toBe(
      512,
    )
    expect(selectAttachmentTransfer(state, 'export', { messageId: 1, index: 0 })).toBeUndefined()
  })
})

describe('selectMessage', () => {
  it('keeps a message when a neighbour changes, and follows it when it changes', () => {
    const before = loaded
    const neighbour = applyEvent(before, {
      type: 'messages-updated',
      messages: [{ ...message(2), body: 'edited' }],
    })
    expect(selectMessage(neighbour, '05alice', 1)).toBe(selectMessage(before, '05alice', 1))

    const changed: Message = { ...message(1), body: 'edited' }
    const after = applyEvent(neighbour, { type: 'messages-updated', messages: [changed] })
    expect(selectMessage(after, '05alice', 1)).toBe(changed)
  })

  it('answers undefined for a message no loaded window holds', () => {
    expect(selectMessage(loaded, '05alice', 3)).toBeUndefined()
    expect(selectMessage(loaded, '05bob', 1)).toBeUndefined()
  })
})
