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

/**
 * Ascending by timestamp, then id: the order a transcript renders and a page cursor keys on.
 *
 * The only ordering this package still decides. libsession orders the conversation lists in SQL
 * and they are taken as they arrive, but it returns a page of history newest-first while a
 * transcript reads oldest-first, so this reversal is ours and has to stay.
 */
export function compareMessages(a: Message, b: Message): number {
  return a.timestamp - b.timestamp || a.id - b.id
}
