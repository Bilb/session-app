import type { Conversation, ConversationId, Message } from '@session/client'
import { createContext, createElement, useContext, useEffect, type ReactNode } from 'react'
import { useStore } from 'zustand'

import type { SessionActions, SessionStore } from './store'
import { transferKey, type MessageWindow, type TransferProgress } from './types'

const StoreContext = createContext<SessionStore | null>(null)

export function SessionStoreProvider(props: {
  store: SessionStore
  children: ReactNode
}): ReactNode {
  return createElement(StoreContext.Provider, { value: props.store }, props.children)
}

function useSessionStore(): SessionStore {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('No session store. Wrap the app in <SessionStoreProvider store={...}>.')
  }
  return store
}

export function useSessionActions(): SessionActions {
  return useSessionStore().actions
}

export function useHydrated(): boolean {
  const store = useSessionStore()
  return useStore(store, (state) => state.hydrated)
}

export function useAccount(): { sessionId?: string; displayName?: string } | null {
  const store = useSessionStore()
  return useStore(store, (state) => state.account)
}

export function useConversations(): Conversation[] {
  const store = useSessionStore()
  const order = useStore(store, (state) => state.conversationOrder)
  const byId = useStore(store, (state) => state.conversations)
  return order.map((id) => byId[id]).filter((c): c is Conversation => c !== undefined)
}

export function useRequests(): Conversation[] {
  const store = useSessionStore()
  const order = useStore(store, (state) => state.requestOrder)
  const byId = useStore(store, (state) => state.requests)
  return order.map((id) => byId[id]).filter((c): c is Conversation => c !== undefined)
}

export function useConversation(id: ConversationId | undefined): Conversation | undefined {
  const store = useSessionStore()
  return useStore(store, (state) =>
    id === undefined ? undefined : (state.conversations[id] ?? state.requests[id]),
  )
}

const EMPTY_WINDOW: MessageWindow = {
  ready: false,
  messages: [],
  exhausted: false,
  fetching: false,
}

/**
 * A conversation's transcript, loading the first page on demand.
 *
 * `ready` is separate from an empty list on purpose: a conversation nobody has said
 * anything in and one that has not been read off disk yet look identical otherwise.
 */
export function useMessages(id: ConversationId | undefined): {
  messages: Message[]
  ready: boolean
  exhausted: boolean
  loadOlder: () => void
} {
  const store = useSessionStore()
  const window = useStore(store, (state) =>
    id === undefined ? EMPTY_WINDOW : (state.histories[id] ?? EMPTY_WINDOW),
  )

  useEffect(() => {
    if (id === undefined) return
    // Also covers history-replaced, which drops the window and leaves ready false.
    if (!window.ready && !window.fetching) void store.actions.loadHistory(id)
  }, [id, window.ready, window.fetching, store])

  return {
    messages: window.messages,
    ready: window.ready,
    exhausted: window.exhausted,
    loadOlder: () => {
      if (id !== undefined) void store.actions.loadOlder(id)
    },
  }
}

export function useTransfer(messageId: number, index: number): TransferProgress | undefined {
  const store = useSessionStore()
  return useStore(store, (state) => state.transfers[transferKey(messageId, index)])
}

/** Unread requests, which is not the same as the number of requests. */
export function useUnreadRequestCount(): number {
  const store = useSessionStore()
  const byId = useStore(store, (state) => state.requests)
  return Object.values(byId).filter((c) => c.unreadCount > 0).length
}
