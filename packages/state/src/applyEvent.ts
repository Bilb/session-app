import type { Conversation, ConversationId, Message, SessionEvent } from '@session/client'

import {
  compareConversations,
  compareMessages,
  type MessageWindow,
  type SessionState,
} from './types'

/**
 * The whole projection, as one pure function.
 *
 * Every event carries complete state, so this only ever replaces - it never merges a delta
 * or goes back to ask for the rest. That is what makes replaying the same event twice
 * harmless, and what lets the store be seeded and then have earlier events land on top of
 * it without contradicting themselves.
 *
 * The objects the bridge hands over are stored as they are: this rebuilds the containers on the
 * path to a change (a map, an id array) and nothing inside them.
 */
export function applyEvent(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'conversation-added':
    case 'conversation-updated':
      return upsertConversation(state, event.conversation)

    case 'conversation-removed':
      return removeConversation(state, event.conversationId)

    case 'conversation-list-replaced':
      return { ...state, ...indexConversations(event.conversations, 'conversations') }

    case 'request-list-replaced':
      return { ...state, ...indexConversations(event.conversations, 'requests') }

    case 'message-added':
    case 'message-updated':
      return upsertMessage(state, event.conversationId, event.message)

    case 'history-replaced':
      // Only the id comes back, so the window is dropped rather than patched: whatever is
      // left of it is no longer known to be true. The screen refetches.
      return {
        ...state,
        histories: {
          ...state.histories,
          [event.conversationId]: {
            ready: false,
            messages: [],
            exhausted: false,
            fetching: false,
          },
        },
      }

    case 'log':
      return state

    default:
      return state
  }
}

type ListKey = 'conversations' | 'requests'
type OrderKey = 'conversationOrder' | 'requestOrder'

const LISTS: Record<ListKey, { order: OrderKey; other: ListKey }> = {
  conversations: { order: 'conversationOrder', other: 'requests' },
  requests: { order: 'requestOrder', other: 'conversations' },
}

export function indexConversations(
  conversations: Conversation[],
  target: ListKey,
): Partial<Pick<SessionState, ListKey | OrderKey>> {
  const byId: Record<ConversationId, Conversation> = {}
  for (const conversation of conversations) byId[conversation.id] = conversation
  // A copy of the pointers, so the event's own array is left in the order it arrived.
  const order = [...conversations].sort(compareConversations).map((c) => c.id)

  return target === 'conversations'
    ? { conversations: byId, conversationOrder: order }
    : { requests: byId, requestOrder: order }
}

/** Where `item` goes in `sorted` to stay sorted, after anything that compares equal to it. */
function insertionIndex<T>(sorted: readonly T[], item: T, compare: (a: T, b: T) => number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (compare(sorted[mid] as T, item) <= 0) low = mid + 1
    else high = mid
  }
  return low
}

/**
 * Approval arrives as an update, not as a removal followed by an addition, so a row that
 * changed side has to be taken out of the list it used to be in. Missing this is what makes
 * a conversation appear in both lists at once.
 *
 * This runs once per message received or sent, so the order is maintained rather than
 * recomputed: a row whose rank did not change keeps the order array it was in, and one whose
 * rank did is moved to where a binary search says it belongs.
 */
function upsertConversation(state: SessionState, conversation: Conversation): SessionState {
  const to: ListKey = conversation.request ? 'requests' : 'conversations'
  const { order: toOrder, other: from } = LISTS[to]
  const fromOrder = LISTS[from].order

  const next: Partial<SessionState> = {}

  if (conversation.id in state[from]) {
    const { [conversation.id]: _moved, ...rest } = state[from]
    next[from] = rest
    next[fromOrder] = state[fromOrder].filter((id) => id !== conversation.id)
  }

  const previous = state[to][conversation.id]
  const byId = { ...state[to], [conversation.id]: conversation }
  next[to] = byId
  next[toOrder] =
    previous && sameRank(previous, conversation)
      ? state[toOrder]
      : placed(state[toOrder], previous !== undefined, conversation.id, byId)

  return { ...state, ...next }
}

function sameRank(a: Conversation, b: Conversation): boolean {
  return a.priority === b.priority && a.lastActivity === b.lastActivity
}

function placed(
  order: ConversationId[],
  present: boolean,
  id: ConversationId,
  byId: Record<ConversationId, Conversation>,
): ConversationId[] {
  const ids = present ? order.filter((each) => each !== id) : order.slice()
  const at = insertionIndex(ids, id, (a, b) =>
    compareConversations(byId[a] as Conversation, byId[b] as Conversation),
  )
  ids.splice(at, 0, id)
  return ids
}

function removeConversation(state: SessionState, id: ConversationId): SessionState {
  const { [id]: _fromList, ...conversations } = state.conversations
  const { [id]: _fromRequests, ...requests } = state.requests
  const { [id]: _history, ...histories } = state.histories

  return {
    ...state,
    conversations,
    requests,
    histories,
    conversationOrder: state.conversationOrder.filter((each) => each !== id),
    requestOrder: state.requestOrder.filter((each) => each !== id),
  }
}

/**
 * Adds or replaces a message, but only in a window that has already been loaded.
 *
 * Starting a window from a single event would leave a transcript that looks complete and is
 * not; the screen asks for the history it wants and events keep it current from there.
 */
function upsertMessage(
  state: SessionState,
  conversationId: ConversationId,
  message: Message,
): SessionState {
  const window = state.histories[conversationId]
  if (!window?.ready) return state

  const current = window.messages
  const existing = current.findIndex((m) => m.id === message.id)
  let messages: Message[]
  if (existing >= 0) {
    messages = current.slice()
    messages[existing] = message
  } else {
    const last = current[current.length - 1]
    if (last === undefined || compareMessages(last, message) <= 0) {
      // The usual case: a message that just happened goes at the end.
      messages = [...current, message]
    } else {
      messages = current.slice()
      messages.splice(insertionIndex(current, message, compareMessages), 0, message)
    }
  }

  const updated: MessageWindow = { ...window, messages }
  return { ...state, histories: { ...state.histories, [conversationId]: updated } }
}

/**
 * An older page in front of what is already loaded. Both are ascending and the page was asked
 * for from before the oldest loaded message, so they concatenate; the sort is only for a seam
 * that turns out not to be one.
 */
export function mergePages(older: Message[], previous: Message[]): Message[] {
  if (previous.length === 0) return older
  if (older.length === 0) return previous
  const all = [...older, ...previous]
  const seam = compareMessages(older[older.length - 1] as Message, previous[0] as Message)
  return seam <= 0 ? all : all.sort(compareMessages)
}
