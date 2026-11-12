import { memoryPorts, NavProvider, resetPorts, setPorts, type NavPort } from '@session/app'
import { createFakeTransport, friends } from '@session/client/fake'
import { createSessionClient } from '@session/client'
import { createSessionStore } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationListScreen } from '#src/ConversationListScreen'
import type * as RowState from '#src/conversationRowState'
import { conversationRowState } from '#src/conversationRowState'

import { renderScreen } from './support/render'

// Called once per row drawn, which is what makes it a render counter for a row.
vi.mock('#src/conversationRowState', async (original) => {
  const actual = await original<typeof RowState>()
  return { ...actual, conversationRowState: vi.fn(actual.conversationRowState) }
})

beforeEach(() => {
  setPorts(memoryPorts())
})
afterEach(() => {
  resetPorts()
})

const NAV: NavPort = { push: () => undefined, replace: () => undefined, back: () => undefined }

it('draws only the row that changed', async () => {
  const { world, clients } = friends(['Alice', 'Bob'])
  const fake = clients['Alice']
  if (!fake) throw new Error('fixture did not produce a client')
  const account = world.account('Alice')
  const [bob] = await fake.getConversations()
  if (!bob) throw new Error('expected a conversation with Bob')
  for (const [at, letter] of ['c', 'd'].entries()) {
    account.upsertConversation(
      { ...bob, id: `05${letter.repeat(64)}`, lastActivity: bob.lastActivity - 1 - at },
      { announce: false },
    )
  }

  const store = createSessionStore(createSessionClient(createFakeTransport(fake)))
  await store.actions.hydrate()
  renderScreen(
    <NavProvider nav={NAV}>
      <ConversationListScreen />
    </NavProvider>,
    { store },
  )
  const drawn = vi.mocked(conversationRowState)
  expect(new Set(drawn.mock.calls.map(([row]) => row)).size).toBe(3)
  drawn.mockClear()

  // First already, so it changes without any row moving.
  act(() => {
    account.emit({
      type: 'conversation-updated',
      conversation: { ...bob, unreadCount: bob.unreadCount + 1 },
      placement: { from: 'conversations', to: 'conversations' },
    })
  })

  // The object the event carried is the one the row is handed.
  const [changed] = store.getState().conversations
  expect(changed?.unreadCount).toBe(bob.unreadCount + 1)
  expect(drawn.mock.calls.length).toBeGreaterThan(0)
  expect(drawn.mock.calls.every(([row]) => row === changed)).toBe(true)
})

describe('a muted row whose mute lapses, with nothing about the row changing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    // Noon on one day for every test: no test but the last turns the day, which draws a row again.
    vi.setSystemTime(new Date(2026, 0, 1, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** The list with Bob muted for `muteMs`, and how many rows it draws as muted. */
  async function drawMutedFor(muteMs: number): Promise<() => number> {
    const { world, clients } = friends(['Alice', 'Bob'])
    const fake = clients['Alice']
    if (!fake) throw new Error('fixture did not produce a client')
    const [bob] = await fake.getConversations()
    if (!bob) throw new Error('expected a conversation with Bob')
    world
      .account('Alice')
      .upsertConversation({ ...bob, muteUntil: Date.now() + muteMs }, { announce: false })

    const store = createSessionStore(createSessionClient(createFakeTransport(fake)))
    await store.actions.hydrate()
    renderScreen(
      <NavProvider nav={NAV}>
        <ConversationListScreen />
      </NavProvider>,
      { store },
    )
    return () => screen.queryAllByTestId(ELEMENT.conversationList.rowMuted).length
  }

  function advance(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('is drawn loud when the mute ends', async () => {
    const muted = await drawMutedFor(60_000)

    expect(muted()).toBe(1)
    advance(59_000)
    expect(muted()).toBe(1)
    advance(1_000)
    expect(muted()).toBe(0)
  })

  it('waits again when its timer fires before the mute has ended', async () => {
    const muted = await drawMutedFor(60_000)

    // The wall clock steps back, as a time sync does: the timer still fires 60 s after it was set.
    vi.setSystemTime(Date.now() - 30_000)
    advance(60_000)
    expect(muted()).toBe(1)
    advance(30_000)
    expect(muted()).toBe(0)
  })

  it('is drawn loud when the mute ends between its render and its effect', async () => {
    const actual = await vi.importActual<typeof RowState>('#src/conversationRowState')
    let moved = false
    vi.mocked(conversationRowState).mockImplementation((row, nowMs) => {
      const state = actual.conversationRowState(row, nowMs)
      if (!moved && state.muted) {
        moved = true
        vi.setSystemTime(Date.now() + 20)
      }
      return state
    })
    try {
      const muted = await drawMutedFor(10)
      expect(muted()).toBe(0)
    } finally {
      vi.mocked(conversationRowState).mockImplementation(actual.conversationRowState)
    }
  })

  it('is drawn loud on coming back to the front after a mute that ended while suspended', async () => {
    const ports = memoryPorts()
    const onFocus = new Set<(focused: boolean) => void>()
    setPorts({
      ...ports,
      window: {
        ...ports.window,
        onFocusChange: (handler) => {
          onFocus.add(handler)
          return () => onFocus.delete(handler)
        },
      },
    })
    const muted = await drawMutedFor(60_000)

    // Suspended: the clock moves and no timer runs.
    vi.setSystemTime(Date.now() + 120_000)
    expect(muted()).toBe(1)
    act(() => {
      for (const handler of onFocus) handler(true)
    })
    expect(muted()).toBe(0)
  })

  // Last: it leaves the shared today clock weeks on, and the next mount would draw its rows twice.
  it('outlasts the longest wait a timer can be given, without asking for a longer one', async () => {
    const longestMs = 2 ** 31 - 1
    const muted = await drawMutedFor(longestMs + 5_000)

    // A wait longer than the longest fires after a millisecond, and would be the next timer.
    const startMs = Date.now()
    act(() => {
      vi.advanceTimersToNextTimer()
    })
    expect(Date.now() - startMs).toBeGreaterThan(1_000)

    advance(longestMs - (Date.now() - startMs))
    expect(muted()).toBe(1)
    advance(5_000)
    expect(muted()).toBe(0)
  })
})
