import type {
  AccountInfo,
  AttachmentRef,
  AttachmentTransfer,
  Conversation,
  ConversationId,
  Message,
  NetworkStatus,
} from '@session/client'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useStore } from 'zustand'

import { coalesced, type ReadableStore } from './coalesce'
import {
  conversationSelector,
  selectAttachmentTransfer,
  selectMessage,
  selectMessageTransfers,
  selectUnreadRequestCount,
} from './selectors'
import type { StartupFailureKind } from './startupFailure'
import type { SessionActions, SessionStore } from './store'
import type {
  AttachmentTransferState,
  MessageTransfers,
  MessageWindow,
  SessionState,
  StoredAppearance,
} from './types'

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

// One per store rather than per hook, so every component is told of a burst in the same pass.
const drawnFrom = new WeakMap<SessionStore, ReadableStore<SessionState>>()

/** What a component draws from the store: read as it is now, told of a burst of changes once. */
function useSessionState<U>(selector: (state: SessionState) => U): U {
  const store = useSessionStore()
  let drawn = drawnFrom.get(store)
  if (!drawn) {
    drawn = coalesced(store)
    drawnFrom.set(store, drawn)
  }
  return useStore(drawn, selector)
}

export function useSessionActions(): SessionActions {
  return useSessionStore().actions
}

export function useHydrated(): boolean {
  return useSessionState((state) => state.hydrated)
}

/**
 * Why the app could not start, or null while it still might.
 *
 * Distinct from `useHydrated` being false, which is the same thing as "still starting" and is why
 * a failed start used to be invisible.
 */
export function useStartupError(): string | null {
  return useSessionState((state) => state.startupError)
}

/** What kind of failed start `useStartupError` is, or null while there is none. */
export function useStartupFailureKind(): StartupFailureKind | null {
  return useSessionState((state) => state.startupFailureKind)
}

/** The theme and accent the account chose, as stored, or null where it has not chosen one. */
export function useAppearance(): StoredAppearance | null {
  return useSessionState((state) => state.appearance)
}

/** The file server's limit on one upload, encrypted and padded, or null before a start asked. */
export function useAttachmentUploadLimit(): number | null {
  return useSessionState((state) => state.attachmentUploadLimitBytes)
}

/** Whether the attached network can carry traffic: see `SessionState.networkStatus`. */
export function useNetworkStatus(): NetworkStatus {
  return useSessionState((state) => state.networkStatus)
}

/** The whole of what libsession says about the account, or null before the first answer. */
export function useAccount(): AccountInfo | null {
  return useSessionState((state) => state.account)
}

/**
 * The list libsession sent, handed on as it is.
 *
 * Nothing to memoise and nothing to rebuild: the state holds the array a screen renders, so a
 * notification that did not change it hands back the same reference.
 */
export function useConversations(): Conversation[] {
  return useSessionState((state) => state.conversations)
}

export function useRequests(): Conversation[] {
  return useSessionState((state) => state.requests)
}

export function useConversation(id: ConversationId | undefined): Conversation | undefined {
  return useSessionState(useMemo(() => conversationSelector(id), [id]))
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
  const window = useSessionState((state) =>
    id === undefined ? EMPTY_WINDOW : (state.histories[id] ?? EMPTY_WINDOW),
  )

  useEffect(() => {
    if (id === undefined) return
    // Also covers history-replaced, which drops the window and leaves ready false.
    if (!window.ready && !window.fetching) void store.actions.loadHistory(id)
  }, [id, window.ready, window.fetching, store])

  // Dropped when this stops showing `id`, and reloaded on the way back.
  //
  // Keyed on the id rather than on unmounting, because on a wide layout the detail pane stays
  // mounted and only the prop changes - there is no unmount to hang this on. Its own effect so
  // the cleanup sees the id it was set up with rather than whatever is current.
  useEffect(() => {
    if (id === undefined) return undefined
    return () => {
      store.actions.forgetHistory(id)
    }
  }, [id, store])

  const loadOlder = useCallback(() => {
    if (id !== undefined) void store.actions.loadOlder(id)
  }, [id, store])

  return useMemo(
    () => ({
      messages: window.messages,
      ready: window.ready,
      exhausted: window.exhausted,
      loadOlder,
    }),
    [window, loadOlder],
  )
}

/**
 * How one attachment transfer is going, or undefined when none has been seen this session.
 *
 * Undefined does not mean the bytes are absent: a transfer that finished before this app was
 * started left nothing behind, because libsession records nothing about one either. The way to
 * find out is to ask for the file - a cached one answers at once.
 */
export function useAttachmentTransfer(
  transfer: AttachmentTransfer,
  ref: AttachmentRef,
): AttachmentTransferState | undefined {
  return useSessionState((state) => selectAttachmentTransfer(state, transfer, ref))
}

/**
 * One message's live transfers, keyed by `transferKey`.
 *
 * For folding a whole message's attachments into one answer without a hook per attachment. The
 * same object until one of this message's transfers moves, so a report for another message does
 * not re-render this one.
 */
export function useMessageTransfers(messageId: number): MessageTransfers {
  return useSessionState((state) => selectMessageTransfers(state, messageId))
}

/**
 * One message of a loaded window, or undefined when no loaded window holds it.
 *
 * The object the last event carried, so this re-renders when that message changes and not when
 * a neighbour does.
 */
export function useMessage(conversationId: ConversationId, messageId: number): Message | undefined {
  return useSessionState((state) => selectMessage(state, conversationId, messageId))
}

/** Unread requests, which is not the same as the number of requests. */
export function useUnreadRequestCount(): number {
  return useSessionState(selectUnreadRequestCount)
}
