import type {
  AccountInfo,
  Conversation,
  ConversationId,
  Message,
  MessageCursor,
} from '@session/client'

/**
 * One conversation's loaded history.
 *
 * `ready` is what tells an empty conversation apart from one nobody has asked for yet -
 * without it a transcript cannot know whether to render "no messages" or a spinner.
 */
export interface MessageWindow {
  ready: boolean
  /** Ascending by (timestamp, id): the order a transcript renders. */
  messages: Message[]
  oldestCursor?: MessageCursor
  exhausted: boolean
  /** Guards against firing a second page request while the first is still out. */
  fetching: boolean
}

export interface SessionState {
  hydrated: boolean
  account: AccountInfo | null

  /** Complete lists. libsession sends whole state, so partial copies would only rot. */
  conversations: Record<ConversationId, Conversation>
  conversationOrder: ConversationId[]
  requests: Record<ConversationId, Conversation>
  requestOrder: ConversationId[]

  histories: Record<ConversationId, MessageWindow>
}

export const emptyState: SessionState = {
  hydrated: false,
  account: null,
  conversations: {},
  conversationOrder: [],
  requests: {},
  requestOrder: [],
  histories: {},
}

/** Pinned first, then most recent, then by id so the order never wobbles between renders. */
export function compareConversations(a: Conversation, b: Conversation): number {
  return b.priority - a.priority || b.lastActivity - a.lastActivity || a.id.localeCompare(b.id)
}

/** Ascending by timestamp, then id: the order a transcript renders and a page cursor keys on. */
export function compareMessages(a: Message, b: Message): number {
  return a.timestamp - b.timestamp || a.id - b.id
}
