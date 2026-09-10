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
  /** In the order a transcript renders, which is the order libsession read them out. */
  messages: Message[]
  oldestCursor?: MessageCursor
  exhausted: boolean
  /** Guards against firing a second page request while the first is still out. */
  fetching: boolean
}

export interface SessionState {
  hydrated: boolean
  account: AccountInfo | null

  /**
   * Complete lists, in the order libsession sent them. libsession sends whole state, so partial
   * copies would only rot.
   *
   * A list and nothing beside it. libsession orders both queries in SQL and does not order them
   * the same way - conversations are `priority DESC, last_activity DESC, id`, requests are
   * `last_activity DESC, id` with no priority at all - so any order of this package's own
   * disagreed with one of the two. An index keyed by id was the other half of that arrangement,
   * and with the order gone it bought nothing: a screen renders the list, and the one lookup by
   * id is a `find` over an array already in memory.
   */
  conversations: Conversation[]
  requests: Conversation[]

  histories: Record<ConversationId, MessageWindow>
}

export const emptyState: SessionState = {
  hydrated: false,
  account: null,
  conversations: [],
  requests: [],
  histories: {},
}
