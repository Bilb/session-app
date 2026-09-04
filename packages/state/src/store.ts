import type { Conversation, ConversationId, Message, SessionClient } from '@session/client'
import { createStore, type StoreApi } from 'zustand/vanilla'

import { applyEvent } from './applyEvent'
import { compareConversations, emptyState, type MessageWindow, type SessionState } from './types'

export interface SessionActions {
  /**
   * Subscribes first, then asks — never the other way round.
   *
   * Anything that arrives between the two is applied on top of the answer, which is safe
   * precisely because every event carries whole state. Asking first and subscribing after
   * is what loses a change that lands in the gap.
   */
  hydrate: () => Promise<void>
  loadHistory: (id: ConversationId) => Promise<void>
  loadOlder: (id: ConversationId) => Promise<void>
  send: (id: ConversationId, body: string, replyTo?: number) => Promise<void>
  markRead: (id: ConversationId) => Promise<void>
  approve: (id: ConversationId) => Promise<void>
  dispose: () => void
}

export type SessionStore = StoreApi<SessionState> & { actions: SessionActions }

const PAGE = 30

export function createSessionStore(client: SessionClient): SessionStore {
  const store = createStore<SessionState>(() => ({ ...emptyState }))

  const unsubscribe = client.onEvent((event) => {
    store.setState((state) => applyEvent(state, event))
  })

  function patchWindow(id: ConversationId, patch: Partial<MessageWindow>): void {
    store.setState((state) => {
      const current: MessageWindow = state.histories[id] ?? {
        ready: false,
        messages: [],
        exhausted: false,
        fetching: false,
      }
      return { histories: { ...state.histories, [id]: { ...current, ...patch } } }
    })
  }

  function windowFrom(messages: Message[], previous: Message[] = []): Partial<MessageWindow> {
    const all = [...previous, ...messages].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id)
    const oldest = all[0]
    return {
      ready: true,
      fetching: false,
      messages: all,
      exhausted: messages.length < PAGE,
      ...(oldest === undefined
        ? {}
        : { oldestCursor: { timestamp: oldest.timestamp, id: oldest.id } }),
    }
  }

  const actions: SessionActions = {
    async hydrate(): Promise<void> {
      const account = await client.getAccountInfo()
      store.setState({ account })

      if (!account.haveAccount) {
        store.setState({ hydrated: true })
        return
      }

      const [conversations, requests] = await Promise.all([
        client.getConversations(),
        client.getMessageRequests(),
      ])

      store.setState((state) => ({
        ...state,
        ...index(conversations, 'conversations'),
        ...index(requests, 'requests'),
        hydrated: true,
      }))
    },

    async loadHistory(id): Promise<void> {
      const existing = store.getState().histories[id]
      if (existing?.fetching) return
      patchWindow(id, { fetching: true })
      const messages = await client.getMessages(id, { limit: PAGE })
      patchWindow(id, windowFrom(messages))
    },

    async loadOlder(id): Promise<void> {
      const window = store.getState().histories[id]
      if (!window || window.fetching || window.exhausted || !window.oldestCursor) return

      patchWindow(id, { fetching: true })
      const older = await client.getMessages(id, { limit: PAGE, before: window.oldestCursor })
      patchWindow(id, windowFrom(older, store.getState().histories[id]?.messages ?? []))
    },

    async send(id, body, replyTo): Promise<void> {
      // No optimistic row: libsession stores the message before this resolves and announces
      // it as message-added, so inventing one here would only produce a duplicate to
      // reconcile.
      await client.sendMessage(id, { body, ...(replyTo === undefined ? {} : { replyTo }) })
    },

    async markRead(id): Promise<void> {
      await client.markRead(id)
    },

    async approve(id): Promise<void> {
      await client.approveConversation(id)
    },

    dispose(): void {
      unsubscribe()
    },
  }

  return Object.assign(store, { actions })
}

function index(
  conversations: Conversation[],
  target: 'conversations' | 'requests',
): Partial<SessionState> {
  const byId: Record<ConversationId, Conversation> = {}
  for (const conversation of conversations) byId[conversation.id] = conversation
  const order = [...conversations].sort(compareConversations).map((c) => c.id)
  return target === 'conversations'
    ? { conversations: byId, conversationOrder: order }
    : { requests: byId, requestOrder: order }
}
