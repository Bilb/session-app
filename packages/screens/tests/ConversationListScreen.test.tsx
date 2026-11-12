import { memoryPorts, NavProvider, resetPorts, setPorts, type NavPort } from '@session/app'
import { createFakeTransport, friends } from '@session/client/fake'
import { createSessionClient } from '@session/client'
import { createSessionStore } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

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

it('draws a muted row as loud once its mute lapses, though nothing about the row changed', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  try {
    const { world, clients } = friends(['Alice', 'Bob'])
    const fake = clients['Alice']
    if (!fake) throw new Error('fixture did not produce a client')
    const [bob] = await fake.getConversations()
    if (!bob) throw new Error('expected a conversation with Bob')
    world
      .account('Alice')
      .upsertConversation({ ...bob, muteUntil: Date.now() + 60_000 }, { announce: false })

    const store = createSessionStore(createSessionClient(createFakeTransport(fake)))
    await store.actions.hydrate()
    renderScreen(
      <NavProvider nav={NAV}>
        <ConversationListScreen />
      </NavProvider>,
      { store },
    )
    const muted = (): number => screen.queryAllByTestId(ELEMENT.conversationList.rowMuted).length

    expect(muted()).toBe(1)
    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(muted()).toBe(1)
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(muted()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
