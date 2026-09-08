import type { Conversation, Message, SessionEvent } from '@session/client'
import { describe, expect, it } from 'vitest'

import { applyEvent, mergePages } from '#src/applyEvent'
import { emptyState, type SessionState } from '#src/types'

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: '05alice',
    kind: 'dm',
    displayName: 'Alice',
    lastActivity: 1000,
    priority: 0,
    unreadCount: 0,
    markedUnread: false,
    request: false,
    awaitingApproval: false,
    noteToSelf: false,
    blocked: false,
    ...overrides,
  }
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    conversationId: '05alice',
    author: '05alice',
    timestamp: 1000,
    body: 'hello',
    outgoing: false,
    sendState: 'sent',
    ...overrides,
  }
}

function replay(events: SessionEvent[], from: SessionState = emptyState): SessionState {
  return events.reduce(applyEvent, from)
}

describe('applyEvent', () => {
  it('orders pinned conversations first, then by recency', () => {
    const state = replay([
      {
        type: 'conversation-list-replaced',
        conversations: [
          conversation({ id: 'a', lastActivity: 3000 }),
          conversation({ id: 'b', lastActivity: 1000, priority: 1 }),
          conversation({ id: 'c', lastActivity: 2000 }),
        ],
      },
    ])

    expect(state.conversationOrder).toEqual(['b', 'a', 'c'])
  })

  it('moves an approved conversation out of the request list', () => {
    const asRequest = conversation({ request: true })
    const state = replay([
      { type: 'conversation-added', conversation: asRequest },
      { type: 'conversation-updated', conversation: { ...asRequest, request: false } },
    ])

    // Approval is an update, not a remove-then-add, so the row has to be taken out of the
    // list it used to be in - otherwise it shows up in both.
    expect(state.requestOrder).toEqual([])
    expect(state.requests['05alice']).toBeUndefined()
    expect(state.conversationOrder).toEqual(['05alice'])
  })

  it('is unchanged by replaying the same event', () => {
    const event: SessionEvent = { type: 'conversation-added', conversation: conversation() }
    const once = replay([event])
    const twice = replay([event, event])

    expect(twice.conversationOrder).toEqual(once.conversationOrder)
    expect(twice.conversations).toEqual(once.conversations)
  })

  it('ignores messages for a conversation whose history was never loaded', () => {
    const state = replay([
      { type: 'conversation-added', conversation: conversation() },
      { type: 'message-added', conversationId: '05alice', message: message() },
    ])

    // A window built from one event would look complete and would not be.
    expect(state.histories['05alice']).toBeUndefined()
  })

  it('inserts a message into a loaded window in timestamp order', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ready: true,
          messages: [message({ id: 1, timestamp: 1000 }), message({ id: 3, timestamp: 3000 })],
          exhausted: true,
          fetching: false,
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'message-added',
      conversationId: '05alice',
      message: message({ id: 2, timestamp: 2000 }),
    })

    expect(state.histories['05alice']?.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('replaces a message in place when its send state changes', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ready: true,
          messages: [message({ id: 1, sendState: 'sending' })],
          exhausted: true,
          fetching: false,
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'message-updated',
      conversationId: '05alice',
      message: message({ id: 1, sendState: 'sent' }),
    })

    const messages = state.histories['05alice']?.messages ?? []
    expect(messages.length).toBe(1)
    expect(messages[0]?.sendState).toBe('sent')
  })

  it('drops the window on history-replaced so the screen refetches', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': { ready: true, messages: [message()], exhausted: true, fetching: false },
      },
    }

    const state = applyEvent(seeded, { type: 'history-replaced', conversationId: '05alice' })

    expect(state.histories['05alice']?.ready).toBe(false)
    expect(state.histories['05alice']?.messages).toEqual([])
  })

  it('forgets a removed conversation everywhere at once', () => {
    const state = replay([
      { type: 'conversation-added', conversation: conversation() },
      { type: 'conversation-removed', conversationId: '05alice' },
    ])

    expect(state.conversations['05alice']).toBeUndefined()
    expect(state.conversationOrder).toEqual([])
    expect(state.histories['05alice']).toBeUndefined()
  })

  it('places an added conversation by rank without disturbing its neighbours', () => {
    const seeded = replay([
      {
        type: 'conversation-list-replaced',
        conversations: [
          conversation({ id: 'pinned', lastActivity: 100, priority: 1 }),
          conversation({ id: 'newer', lastActivity: 3000 }),
          conversation({ id: 'older', lastActivity: 1000 }),
        ],
      },
    ])

    const front = applyEvent(seeded, {
      type: 'conversation-added',
      conversation: conversation({ id: 'top', lastActivity: 1, priority: 2 }),
    })
    const middle = applyEvent(seeded, {
      type: 'conversation-added',
      conversation: conversation({ id: 'mid', lastActivity: 2000 }),
    })
    const end = applyEvent(seeded, {
      type: 'conversation-added',
      conversation: conversation({ id: 'last', lastActivity: 5 }),
    })

    expect(front.conversationOrder).toEqual(['top', 'pinned', 'newer', 'older'])
    expect(middle.conversationOrder).toEqual(['pinned', 'newer', 'mid', 'older'])
    expect(end.conversationOrder).toEqual(['pinned', 'newer', 'older', 'last'])
  })

  it('moves an updated conversation to its new rank', () => {
    const seeded = replay([
      {
        type: 'conversation-list-replaced',
        conversations: [
          conversation({ id: 'a', lastActivity: 3000 }),
          conversation({ id: 'b', lastActivity: 2000 }),
          conversation({ id: 'c', lastActivity: 1000 }),
        ],
      },
    ])

    const state = applyEvent(seeded, {
      type: 'conversation-updated',
      conversation: conversation({ id: 'c', lastActivity: 4000 }),
    })

    expect(state.conversationOrder).toEqual(['c', 'a', 'b'])
    expect(state.conversations['c']?.lastActivity).toBe(4000)
  })

  it('keeps the order array when an update does not change rank', () => {
    const seeded = replay([
      {
        type: 'conversation-list-replaced',
        conversations: [
          conversation({ id: 'a', lastActivity: 3000 }),
          conversation({ id: 'b', lastActivity: 2000 }),
        ],
      },
    ])

    const state = applyEvent(seeded, {
      type: 'conversation-updated',
      conversation: conversation({ id: 'b', lastActivity: 2000, unreadCount: 3 }),
    })

    // A read count changed, the order did not: the list a screen is subscribed to is the same
    // array, so nothing that only watches the order re-renders.
    expect(state.conversationOrder).toBe(seeded.conversationOrder)
    expect(state.conversations['b']?.unreadCount).toBe(3)
  })

  it('leaves the other list alone when the conversation was never in it', () => {
    const seeded = replay([
      { type: 'conversation-added', conversation: conversation({ id: 'req', request: true }) },
    ])

    const state = applyEvent(seeded, {
      type: 'conversation-added',
      conversation: conversation({ id: 'friend' }),
    })

    expect(state.requests).toBe(seeded.requests)
    expect(state.requestOrder).toBe(seeded.requestOrder)
    expect(state.conversationOrder).toEqual(['friend'])
  })

  it('appends a message that is newer than the whole window', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ready: true,
          messages: [message({ id: 1, timestamp: 1000 }), message({ id: 2, timestamp: 2000 })],
          exhausted: true,
          fetching: false,
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'message-added',
      conversationId: '05alice',
      message: message({ id: 3, timestamp: 3000 }),
    })

    expect(state.histories['05alice']?.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('stores the conversation and message objects the events carried', () => {
    const convo = conversation()
    const msg = message()
    const seeded: SessionState = {
      ...emptyState,
      histories: { '05alice': { ready: true, messages: [], exhausted: true, fetching: false } },
    }
    const state = replay(
      [
        { type: 'conversation-added', conversation: convo },
        { type: 'message-added', conversationId: '05alice', message: msg },
      ],
      seeded,
    )

    expect(state.conversations['05alice']).toBe(convo)
    expect(state.histories['05alice']?.messages[0]).toBe(msg)
  })
})

describe('mergePages', () => {
  it('puts an older page in front of the loaded window without sorting', () => {
    const older = [message({ id: 1, timestamp: 1000 }), message({ id: 2, timestamp: 2000 })]
    const previous = [message({ id: 3, timestamp: 3000 })]

    expect(mergePages(older, previous).map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('returns the page itself when nothing was loaded yet', () => {
    const page = [message({ id: 1 })]
    expect(mergePages(page, [])).toBe(page)
  })

  it('still sorts when the pages overlap', () => {
    const older = [message({ id: 1, timestamp: 1000 }), message({ id: 3, timestamp: 3000 })]
    const previous = [message({ id: 2, timestamp: 2000 })]

    expect(mergePages(older, previous).map((m) => m.id)).toEqual([1, 2, 3])
  })
})
