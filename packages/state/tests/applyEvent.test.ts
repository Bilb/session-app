import type { Conversation, ListPlacement, Message, SessionEvent } from '@session/client'
import { describe, expect, it } from 'vitest'

import { applyEvent, mergePages, recordRefusal } from '#src/applyEvent'
import { emptyState, emptyWindow, type SessionState } from '#src/types'

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
    attachments: [],
    galleryViewable: false,
    gallery: false,
    ...overrides,
  }
}

/**
 * A loaded history holding the message the reports below are about.
 *
 * A report names a message and not a conversation, so what decides whether one is kept is
 * whether some loaded window holds that message.
 */
function loaded(messages: Message[] = [message()]): SessionState {
  return {
    ...emptyState,
    histories: {
      '05alice': { ...emptyWindow, ready: true, messages },
    },
  }
}

function progress(
  overrides: Partial<Extract<SessionEvent, { type: 'attachment-progress' }>> = {},
): SessionEvent {
  return {
    type: 'attachment-progress',
    transfer: 'download',
    messageId: 1,
    index: 0,
    doneBytes: 0,
    totalBytes: 0,
    ...overrides,
  }
}

function replay(events: SessionEvent[], from: SessionState = emptyState): SessionState {
  return events.reduce(applyEvent, from)
}

const ids = (list: Conversation[]): string[] => list.map((c) => c.id)

/** First in the list its row belongs in, which is where a newest row goes. */
function first(c: Conversation): ListPlacement {
  return { from: 'none', to: c.request ? 'requests' : 'conversations' }
}

function added(c: Conversation, placement: ListPlacement = first(c)): SessionEvent {
  return { type: 'conversation-added', conversation: c, placement }
}

function updated(c: Conversation, placement: ListPlacement = first(c)): SessionEvent {
  return { type: 'conversation-updated', conversation: c, placement }
}

/** The conversation list as the store holds it once read, in libsession's order. */
function seededList(...rowIds: string[]): SessionState {
  return { ...emptyState, conversations: rowIds.map((id) => conversation({ id })) }
}

describe('applyEvent', () => {
  it('keeps the order libsession placed, rather than imposing one', () => {
    // Deliberately not the order our own comparator would produce: libsession orders both lists
    // in SQL, and it orders them differently from each other - requests carry no priority term.
    // A store that re-sorted would disagree with the request list today and with any later change
    // to the sort rules.
    const seeded: SessionState = {
      ...emptyState,
      conversations: [
        conversation({ id: 'a', lastActivity: 3000 }),
        conversation({ id: 'b', lastActivity: 1000, priority: 1 }),
      ],
    }
    const state = applyEvent(
      seeded,
      updated(conversation({ id: 'c', lastActivity: 2000 }), {
        from: 'none',
        to: 'conversations',
        after: 'b',
      }),
    )

    expect(ids(state.conversations)).toEqual(['a', 'b', 'c'])
  })

  it('moves an approved conversation out of the request list', () => {
    const asRequest = conversation({ request: true })
    const state = replay([
      added(asRequest),
      updated({ ...asRequest, request: false }, { from: 'requests', to: 'conversations' }),
    ])

    // Approval is an update, not a remove-then-add, so the row has to be taken out of the
    // list it used to be in - otherwise it shows up in both.
    expect(ids(state.requests)).toEqual([])
    expect(ids(state.conversations)).toEqual(['05alice'])
  })

  it('is unchanged by replaying the same event', () => {
    const event = added(conversation())
    const once = replay([event])
    const twice = replay([event, event])

    expect(twice.conversations).toEqual(once.conversations)
  })

  it('ignores messages for a conversation whose history was never loaded', () => {
    const state = replay([added(conversation()), { type: 'messages-added', messages: [message()] }])

    // A window built from one event would look complete and would not be.
    expect(state.histories['05alice']).toBeUndefined()
  })

  /** A window of the messages dated 2000 and 3000, which history may go on past either way. */
  function windowOf(ends: { hasOlder?: boolean; hasNewer?: boolean } = {}): SessionState {
    return {
      ...emptyState,
      histories: {
        '05alice': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 2, timestamp: 2000 }), message({ id: 4, timestamp: 4000 })],
          ...ends,
        },
      },
    }
  }
  const idsAfter = (seeded: SessionState, arrived: Partial<Message>): number[] | undefined =>
    applyEvent(seeded, { type: 'messages-added', messages: [message(arrived)] }).histories[
      '05alice'
    ]?.messages.map((m) => m.id)

  it('places an added message by its own time, not by when it arrived', () => {
    expect(idsAfter(windowOf(), { id: 9, timestamp: 3000 })).toEqual([2, 9, 4])
    expect(idsAfter(windowOf(), { id: 9, timestamp: 5000 })).toEqual([2, 4, 9])
    expect(idsAfter(windowOf(), { id: 9, timestamp: 1000 })).toEqual([9, 2, 4])
  })

  it('orders messages sharing a timestamp by id', () => {
    expect(idsAfter(windowOf(), { id: 3, timestamp: 2000 })).toEqual([2, 3, 4])
    expect(idsAfter(windowOf(), { id: 1, timestamp: 2000 })).toEqual([1, 2, 4])
  })

  it('leaves out a message past an end history goes on beyond, which paging reads', () => {
    const newerUnread = windowOf({ hasNewer: true })
    expect(idsAfter(newerUnread, { id: 9, timestamp: 5000 })).toEqual([2, 4])
    // Between the ends it is the window's, whichever way history goes on.
    expect(idsAfter(newerUnread, { id: 9, timestamp: 3000 })).toEqual([2, 9, 4])
    expect(idsAfter(newerUnread, { id: 9, timestamp: 1000 })).toEqual([9, 2, 4])

    const olderUnread = windowOf({ hasOlder: true })
    expect(idsAfter(olderUnread, { id: 9, timestamp: 1000 })).toEqual([2, 4])
    expect(idsAfter(olderUnread, { id: 9, timestamp: 5000 })).toEqual([2, 4, 9])
  })

  it('takes an update to a message the window does not hold only where it belongs', () => {
    const seeded = windowOf({ hasOlder: true })
    const state = applyEvent(seeded, {
      type: 'messages-updated',
      messages: [message({ id: 1, timestamp: 1000 })],
    })
    expect(state).toBe(seeded)
  })

  it('leaves out a deleted message it does not hold, as a page does', () => {
    const seeded = windowOf()
    const state = applyEvent(seeded, {
      type: 'messages-updated',
      messages: [message({ id: 3, timestamp: 3000, body: '', deleted: 'everywhere' })],
    })
    expect(state).toBe(seeded)
  })

  it('holds a message once when it is announced after the page that read it', () => {
    const seeded = windowOf()
    const state = applyEvent(seeded, {
      type: 'messages-added',
      messages: [message({ id: 4, timestamp: 4000, body: 'again' })],
    })
    expect(state.histories['05alice']?.messages.map((m) => [m.id, m.body])).toEqual([
      [2, 'hello'],
      [4, 'again'],
    ])
  })

  it('replaces a message in place when its send state changes', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 1, sendState: 'sending' })],
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'messages-updated',
      messages: [message({ id: 1, sendState: 'sent' })],
    })

    const messages = state.histories['05alice']?.messages ?? []
    expect(messages.length).toBe(1)
    expect(messages[0]?.sendState).toBe('sent')
  })

  it('drops the window on history-replaced so the screen refetches', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': { ...emptyWindow, ready: true, messages: [message()] },
      },
    }

    const state = applyEvent(seeded, { type: 'history-replaced', conversationId: '05alice' })

    expect(state.histories['05alice']?.ready).toBe(false)
    expect(state.histories['05alice']?.messages).toEqual([])
  })

  it('forgets a removed conversation everywhere at once', () => {
    const state = replay([
      added(conversation()),
      { type: 'conversation-removed', conversationId: '05alice', list: 'conversations' },
    ])

    expect(ids(state.conversations)).toEqual([])
    expect(state.histories['05alice']).toBeUndefined()
  })

  it('puts a row where its placement says, rather than deciding', () => {
    const seeded = seededList('a', 'b', 'c')

    // A rank that would sort to the end under any comparator: it still goes first, because that is
    // where libsession placed it.
    const top = applyEvent(seeded, added(conversation({ id: 'top', lastActivity: 1 })))
    expect(ids(top.conversations)).toEqual(['top', 'a', 'b', 'c'])

    const moved = applyEvent(
      seeded,
      updated(conversation({ id: 'c' }), {
        from: 'conversations',
        to: 'conversations',
        after: 'a',
      }),
    )
    expect(ids(moved.conversations)).toEqual(['a', 'c', 'b'])
  })

  it('finds the row in either list, whatever the placement says it was in', () => {
    // `from` is where libsession last reported the row, and it never reported one the app read for
    // itself: that one comes with `from: none` while the store is holding it.
    const seeded = seededList('a', 'b')
    const state = applyEvent(
      seeded,
      updated(conversation({ id: 'b', unreadCount: 3 }), { from: 'none', to: 'conversations' }),
    )

    expect(ids(state.conversations)).toEqual(['b', 'a'])
    expect(state.conversations[0]?.unreadCount).toBe(3)
  })

  it('takes a hidden row out of both lists', () => {
    const seeded = seededList('a', 'b')
    const state = applyEvent(
      seeded,
      updated(conversation({ id: 'a', priority: -1 }), { from: 'conversations', to: 'none' }),
    )

    expect(ids(state.conversations)).toEqual(['b'])
    expect(state.listsOutOfStep).toEqual({ conversations: false, requests: false })
  })

  it('flags a list a row was placed after a stranger in, and keeps the row', () => {
    const seeded = seededList('a', 'b')
    const state = applyEvent(
      seeded,
      added(conversation({ id: 'new' }), { from: 'none', to: 'conversations', after: 'missing' }),
    )

    // Kept so it is not lost while the store reads the list again; flagged because no later
    // placement can put a list right that is missing the row it places against.
    expect(ids(state.conversations)).toEqual(['a', 'b', 'new'])
    expect(state.listsOutOfStep).toEqual({ conversations: true, requests: false })
  })

  it('stays flagged through later placements, which cannot put the list right', () => {
    const flagged = applyEvent(
      seededList('a'),
      added(conversation({ id: 'new' }), { from: 'none', to: 'conversations', after: 'missing' }),
    )
    const state = applyEvent(flagged, updated(conversation({ id: 'a' })))

    expect(state.listsOutOfStep.conversations).toBe(true)
  })

  it('keeps a row in its place when the placement leaves it there', () => {
    const seeded = seededList('a', 'b')

    const state = applyEvent(
      seeded,
      updated(conversation({ id: 'b', unreadCount: 3 }), {
        from: 'conversations',
        to: 'conversations',
        after: 'a',
      }),
    )

    // The row it replaced keeps its place, so the list still reads in libsession's order.
    expect(ids(state.conversations)).toEqual(ids(seeded.conversations))
    expect(state.conversations.find((c) => c.id === 'b')?.unreadCount).toBe(3)
  })

  it('hands back the same row objects when one row changes in place', () => {
    const seeded = seededList('a', 'b', 'c')
    const state = applyEvent(
      seeded,
      updated(conversation({ id: 'a', unreadCount: 3 }), { from: 'none', to: 'conversations' }),
    )

    // First with no `after`, and already first: replaced where it is.
    expect(ids(state.conversations)).toEqual(['a', 'b', 'c'])
    expect(state.conversations[0]?.unreadCount).toBe(3)
    expect(state.conversations[1]).toBe(seeded.conversations[1])
    expect(state.conversations[2]).toBe(seeded.conversations[2])
    expect(state.conversations).not.toBe(seeded.conversations)
    expect(state.requests).toBe(seeded.requests)
  })

  it('takes a row out of both lists when both hold it', () => {
    // A list read after a row crossed, while the placement that crossed it is still to come,
    // holds the row the other list has not given up yet.
    const row = conversation({ id: 'x' })
    const both: SessionState = {
      ...emptyState,
      conversations: [row, conversation({ id: 'a' })],
      requests: [conversation({ id: 'r', request: true }), { ...row, request: true }],
    }

    // In place in the list it belongs in, which must not stop the other being searched.
    const inPlace = applyEvent(both, updated(row, { from: 'requests', to: 'conversations' }))
    expect(ids(inPlace.conversations)).toEqual(['x', 'a'])
    expect(ids(inPlace.requests)).toEqual(['r'])

    const moved = applyEvent(
      both,
      updated(row, { from: 'requests', to: 'conversations', after: 'a' }),
    )
    expect(ids(moved.conversations)).toEqual(['a', 'x'])
    expect(ids(moved.requests)).toEqual(['r'])

    const hidden = applyEvent(both, updated(row, { from: 'requests', to: 'none' }))
    expect(ids(hidden.conversations)).toEqual(['a'])
    expect(ids(hidden.requests)).toEqual(['r'])
  })

  it('moves a row down as well as up, and to the end', () => {
    const seeded = seededList('a', 'b', 'c')
    const place = (id: string, after?: string): string[] =>
      ids(
        applyEvent(
          seeded,
          updated(conversation({ id }), {
            from: 'conversations',
            to: 'conversations',
            ...(after === undefined ? {} : { after }),
          }),
        ).conversations,
      )

    expect(place('a', 'b')).toEqual(['b', 'a', 'c'])
    expect(place('a', 'c')).toEqual(['b', 'c', 'a'])
    expect(place('c')).toEqual(['c', 'a', 'b'])
    expect(place('b', 'c')).toEqual(['a', 'c', 'b'])
  })

  it('flags a row placed after itself, which names no row', () => {
    const state = applyEvent(
      seededList('a', 'b'),
      updated(conversation({ id: 'a' }), { from: 'none', to: 'conversations', after: 'a' }),
    )

    expect(ids(state.conversations)).toEqual(['b', 'a'])
    expect(state.listsOutOfStep.conversations).toBe(true)
  })

  it('leaves the other list alone when the conversation was never in it', () => {
    const seeded = replay([added(conversation({ id: 'req', request: true }))])

    const state = applyEvent(seeded, added(conversation({ id: 'friend' })))

    // The same array, not merely an equal one: a screen watching the request list must not
    // re-render because a conversation it does not hold changed.
    expect(state.requests).toBe(seeded.requests)
    expect(ids(state.conversations)).toEqual(['friend'])
  })

  it('appends a message that is newer than the whole window', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 1, timestamp: 1000 }), message({ id: 2, timestamp: 2000 })],
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'messages-added',
      messages: [message({ id: 3, timestamp: 3000 })],
    })

    expect(state.histories['05alice']?.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('applies a batch spanning conversations to each loaded window, in order', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 1 })],
        },
        '05bob': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 2, conversationId: '05bob' })],
        },
      },
    }

    const state = applyEvent(seeded, {
      type: 'messages-updated',
      messages: [
        message({ id: 1, body: 'first edit' }),
        message({ id: 2, conversationId: '05bob', body: 'bob edit' }),
        message({ id: 3, conversationId: '05carol' }),
        message({ id: 1, body: 'second edit' }),
      ],
    })

    expect(state.histories['05alice']?.messages.map((m) => m.body)).toEqual(['second edit'])
    expect(state.histories['05bob']?.messages.map((m) => m.body)).toEqual(['bob edit'])
    // Not loaded, so not started from one message.
    expect(state.histories['05carol']).toBeUndefined()
  })

  it('stores the conversation and message objects the events carried', () => {
    const convo = conversation()
    const msg = message()
    const seeded: SessionState = {
      ...emptyState,
      histories: { '05alice': { ...emptyWindow, ready: true, messages: [] } },
    }
    const state = replay([added(convo), { type: 'messages-added', messages: [msg] }], seeded)

    expect(state.conversations[0]).toBe(convo)
    expect(state.histories['05alice']?.messages[0]).toBe(msg)
  })
})

describe('mergePages', () => {
  it('puts the older run in front of the newer one', () => {
    const older = [message({ id: 1, timestamp: 1000 }), message({ id: 2, timestamp: 2000 })]
    const newer = [message({ id: 3, timestamp: 3000 })]

    expect(mergePages(older, newer).map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('returns the page itself when nothing was loaded yet', () => {
    const page = [message({ id: 1 })]
    expect(mergePages(page, [])).toBe(page)
    expect(mergePages([], page)).toBe(page)
  })
})

describe('attachment transfers', () => {
  it('records a report against the transfer it belongs to', () => {
    const state = replay(
      [progress(), progress({ doneBytes: 512, totalBytes: 2048 })],
      loaded([message()]),
    )

    expect(state.transfers[1]?.['download:0']).toEqual({
      state: 'running',
      doneBytes: 512,
      totalBytes: 2048,
    })
  })

  it('keeps a download and an export of the same attachment apart', () => {
    // One file can be downloading and exporting at once, on separate transfers if libsession's
    // `requested_cache_max_size` refuses it: keyed only by message and index the reports would
    // overwrite each other and the bar would jump backwards.
    const state = replay(
      [
        progress({ transfer: 'download', doneBytes: 1024, totalBytes: 2048 }),
        progress({ transfer: 'export', doneBytes: 64, totalBytes: 2048 }),
      ],
      loaded(),
    )

    expect(state.transfers[1]?.['download:0']?.doneBytes).toBe(1024)
    expect(state.transfers[1]?.['export:0']?.doneBytes).toBe(64)
  })

  it('returns the same state for a report identical to the stored one', () => {
    const before = replay([progress({ doneBytes: 512, totalBytes: 2048 })], loaded())
    const after = applyEvent(before, progress({ doneBytes: 512, totalBytes: 2048 }))
    expect(after).toBe(before)

    const failed = replay(
      [progress({ doneBytes: 0, totalBytes: 0, outcome: { ok: false, error: 'file.not_found' } })],
      loaded(),
    )
    expect(
      applyEvent(
        failed,
        progress({ doneBytes: 0, totalBytes: 0, outcome: { ok: false, error: 'file.not_found' } }),
      ),
    ).toBe(failed)
  })

  it('treats an ok outcome as finished and any other as failed', () => {
    const ok = replay(
      [progress({ doneBytes: 2048, totalBytes: 2048, outcome: { ok: true } })],
      loaded(),
    )
    expect(ok.transfers[1]?.['download:0']?.state).toBe('done')

    const bad = replay(
      [
        progress({
          doneBytes: 2048,
          totalBytes: 2048,
          outcome: { ok: false, error: 'file.unreadable' },
        }),
      ],
      loaded(),
    )
    expect(bad.transfers[1]?.['download:0']?.state).toBe('failed')
    expect(bad.transfers[1]?.['download:0']?.error).toBe('file.unreadable')
  })

  it('does not finish a transfer that has moved every byte but reported no outcome', () => {
    // doneBytes === totalBytes arrives before the verification does, so reading it as finished
    // shows a file as ready that may still fail.
    const state = replay([progress({ doneBytes: 2048, totalBytes: 2048 })], loaded())
    expect(state.transfers[1]?.['download:0']?.state).toBe('running')
  })

  it('drops reports for a conversation whose history is not loaded', () => {
    // An auto-downloading conversation reports whether or not anyone is looking at it.
    const state = replay([progress()], emptyState)
    expect(Object.keys(state.transfers)).toEqual([])
  })

  it('forgets a conversation transfers when its history is replaced', () => {
    const state = replay(
      [
        progress({ doneBytes: 512, totalBytes: 2048 }),
        { type: 'history-replaced', conversationId: '05alice' },
      ],
      loaded(),
    )
    expect(Object.keys(state.transfers)).toEqual([])
  })

  it('drops only the transfers of the messages in the replaced window', () => {
    const seeded: SessionState = {
      ...emptyState,
      histories: {
        '05alice': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 1 })],
        },
        '05bob': {
          ...emptyWindow,
          ready: true,
          messages: [message({ id: 2, conversationId: '05bob' })],
        },
      },
    }
    const state = replay(
      [
        progress({ messageId: 1 }),
        progress({ messageId: 2 }),
        { type: 'history-replaced', conversationId: '05alice' },
      ],
      seeded,
    )
    expect(Object.keys(state.transfers)).toEqual(['2'])
  })

  it('forgets a removed conversation transfers', () => {
    const state = replay(
      [
        progress({ doneBytes: 512, totalBytes: 2048 }),
        { type: 'conversation-removed', conversationId: '05alice', list: 'conversations' },
      ],
      loaded(),
    )
    expect(state.transfers).toEqual({})
  })

  it('drops a report for a window history-replaced left unready', () => {
    const state = replay(
      [{ type: 'history-replaced', conversationId: '05alice' }, progress({ doneBytes: 512 })],
      loaded(),
    )
    expect(state.histories['05alice']?.ready).toBe(false)
    expect(state.transfers).toEqual({})
  })

  it('drops a finished download once its message is announced, so an eviction reads as absent', () => {
    const withFile = message({
      attachments: [
        {
          index: 0,
          voiceMessage: false,
          hasThumbhash: false,
          hasThumbnail: false,
          thumbnailWidthPx: 0,
          thumbnailHeightPx: 0,
          hasRendition: false,
          renditionRefused: false,
          originalFile: false,
          uploaded: true,
          availability: 'cached',
          fetchDoneBytes: 0,
          fetchTotalBytes: 0,
        },
      ],
    })
    const done = replay(
      [
        progress({ doneBytes: 9, totalBytes: 9, outcome: { ok: true } }),
        progress({ transfer: 'export', doneBytes: 9, totalBytes: 9, outcome: { ok: true } }),
      ],
      loaded([withFile]),
    )
    const announced = applyEvent(done, { type: 'messages-updated', messages: [withFile] })

    expect(announced.transfers[1]?.['download:0']).toBeUndefined()
    expect(announced.transfers[1]?.['export:0']?.state).toBe('done')
  })

  describe('an upload', () => {
    const file = (index: number, uploaded: boolean) => ({
      index,
      voiceMessage: false,
      hasThumbhash: false,
      hasThumbnail: false,
      thumbnailWidthPx: 0,
      thumbnailHeightPx: 0,
      hasRendition: false,
      renditionRefused: false,
      originalFile: false,
      uploaded,
      availability: 'cached' as const,
      fetchDoneBytes: 0,
      fetchTotalBytes: 0,
    })
    const sending = (sendState: Message['sendState'], uploaded = [false, false]) =>
      message({
        outgoing: true,
        sendState,
        attachments: uploaded.map((up, index) => file(index, up)),
      })
    const upload = (
      overrides: Partial<Extract<SessionEvent, { type: 'attachment-progress' }>> = {},
    ) => progress({ transfer: 'upload', ...overrides })

    it('is kept by file beside the downloads, while its message is uploading', () => {
      const state = replay(
        [
          upload({ index: 0, doneBytes: 900, totalBytes: 900, outcome: { ok: true } }),
          upload({ index: 1, doneBytes: 300, totalBytes: 1200 }),
        ],
        loaded([sending('uploading')]),
      )
      expect(state.transfers[1]).toEqual({
        'upload:0': { state: 'done', doneBytes: 900, totalBytes: 900 },
        'upload:1': { state: 'running', doneBytes: 300, totalBytes: 1200 },
      })
    })

    it('outlives its message being announced while it is still uploading', () => {
      const running = replay(
        [upload({ index: 0, doneBytes: 900, totalBytes: 900, outcome: { ok: true } })],
        loaded([sending('uploading')]),
      )
      const announced = applyEvent(running, {
        type: 'messages-updated',
        messages: [sending('uploading', [true, false])],
      })
      expect(announced.transfers[1]?.['upload:0']?.state).toBe('done')
    })

    it('is dropped once its message is announced past uploading, whatever it reached', () => {
      const running = replay(
        [
          upload({ index: 0, doneBytes: 900, totalBytes: 900, outcome: { ok: true } }),
          upload({ index: 1, doneBytes: 0, totalBytes: 0, outcome: { ok: false } }),
        ],
        loaded([sending('uploading')]),
      )
      const failed = applyEvent(running, {
        type: 'messages-updated',
        messages: [sending('failed', [true, false])],
      })
      expect(failed.transfers[1]).toEqual({})
    })

    it('is not recorded for a message that has already left uploading', () => {
      // A file that fails at once is reported after its message has been announced failed.
      const state = replay(
        [upload({ index: 0, outcome: { ok: false, error: 'attachment.unreadable' } })],
        loaded([sending('failed')]),
      )
      expect(state.transfers).toEqual({})
    })

    it('starts afresh on a retry', () => {
      const first = replay(
        [upload({ index: 1, doneBytes: 600, totalBytes: 1200 })],
        loaded([sending('uploading', [true, false])]),
      )
      const retried = replay(
        [
          { type: 'messages-updated', messages: [sending('failed', [true, false])] },
          { type: 'messages-updated', messages: [sending('uploading', [true, false])] },
          upload({ index: 1, doneBytes: 0, totalBytes: 0 }),
        ],
        first,
      )
      expect(retried.transfers[1]).toEqual({
        'upload:1': { state: 'running', doneBytes: 0, totalBytes: 0 },
      })
    })
  })

  it('keeps a failed download when its message is announced', () => {
    // Availability cannot say a fetch failed transiently, so this report is the only record.
    const withFile = message({
      attachments: [
        {
          index: 0,
          voiceMessage: false,
          hasThumbhash: false,
          hasThumbnail: false,
          thumbnailWidthPx: 0,
          thumbnailHeightPx: 0,
          hasRendition: false,
          renditionRefused: false,
          originalFile: false,
          uploaded: true,
          availability: 'absent',
          fetchDoneBytes: 0,
          fetchTotalBytes: 0,
        },
      ],
    })
    const failed = replay([progress({ outcome: { ok: false } })], loaded([withFile]))
    const announced = applyEvent(failed, { type: 'messages-updated', messages: [withFile] })
    expect(announced.transfers[1]?.['download:0']?.state).toBe('failed')
  })

  it('records a refusal that reached no event as a failed transfer', () => {
    const refused = recordRefusal(loaded(), 'download', { messageId: 1, index: 0 })
    expect(refused.transfers[1]?.['download:0']).toEqual({
      state: 'failed',
      doneBytes: 0,
      totalBytes: 0,
    })
  })

  it('leaves a failed report from libsession in place of a refusal', () => {
    const reported = replay(
      [
        progress({
          doneBytes: 3,
          totalBytes: 9,
          outcome: { ok: false, error: 'file.download_failed' },
        }),
      ],
      loaded(),
    )
    expect(recordRefusal(reported, 'download', { messageId: 1, index: 0 })).toBe(reported)
  })

  it('leaves the transfer map alone when nothing in it changed', () => {
    const before = replay([progress()], loaded())
    const after = applyEvent(before, { type: 'history-replaced', conversationId: '05bob' })
    expect(after.transfers).toBe(before.transfers)
  })
})

describe('the network status', () => {
  it('starts unknown and follows each change in order', () => {
    expect(emptyState.networkStatus).toBe('unknown')
    const after = replay(
      [
        { type: 'network-status-changed', status: 'connecting' },
        { type: 'network-status-changed', status: 'connected' },
        { type: 'network-status-changed', status: 'disconnected' },
      ],
      emptyState,
    )
    expect(after.networkStatus).toBe('disconnected')
  })

  it('leaves the state as it was for a repeat, which a status answer can be', () => {
    const connected = replay([{ type: 'network-status-changed', status: 'connected' }], emptyState)
    expect(applyEvent(connected, { type: 'network-status-changed', status: 'connected' })).toBe(
      connected,
    )
  })
})
