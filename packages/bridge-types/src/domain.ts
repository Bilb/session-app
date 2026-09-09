/**
 * What the app sees of libsession, and what the bridge carries: these are the same types.
 *
 * The C++ shim fills structs generated from this file and the platform layer turns them into
 * JavaScript objects of exactly this shape, so nothing between libsession and a screen converts
 * anything. Timestamps are unix milliseconds, ids are sqlite rowids, sizes are byte counts; all
 * are far inside 2^53, which is why they are plain numbers rather than bigints.
 *
 * Enum values are libsession's own, spelled as strings so a switch reads well.
 */

export type ConversationId = string

export type ConversationKind = 'dm' | 'group' | 'community'

/**
 * Mirrors libsession's own send-state machine, value for value.
 *
 * Complete rather than trimmed to what this bridge can reach: `uploading` and `unsendable` are
 * both about attachments, which nothing here can send yet, but they are libsession's states and
 * the shim's switch over them has to name every one.
 */
export type SendState =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  /** Left in flight when the process stopped: libsession's send queue does not survive it. */
  | 'interrupted'
  | 'uploading'
  | 'unsendable'

export type Deletion = 'here' | 'everywhere'

/**
 * Where a page of history starts. Newest-first, keyed by (timestamp, id) so that a page seam
 * cannot duplicate or skip a message that shares a timestamp with its neighbour.
 */
export interface MessageCursor {
  timestamp: number
  id: number
}

/**
 * The message a reply points at, resolved one level deep only: a reply to a reply shows its own
 * parent, not the whole chain, so `body` is absent on a nested reply even when `messageId` is set.
 */
export interface Reply {
  author: string
  timestamp: number
  messageId?: number
  body?: string
}

export interface Message {
  id: number
  conversationId: ConversationId
  author: string
  timestamp: number
  body: string
  outgoing: boolean
  /**
   * Delivery to the recipient - what "did it arrive" means, and what a transcript shows.
   *
   * Incoming messages have no send state of their own and report `sent`; every consumer reads
   * this behind `outgoing`, so an absent value would only move the question.
   */
  sendState: SendState
  /**
   * Delivery of the copy deposited in our own swarm, which is how our other devices come to see
   * a message we sent. A separate send, retried separately, so it can still be pending when the
   * recipient already has the message - which is why it is not what a transcript shows.
   *
   * Unset where there was no such send to report: an incoming message, and a note to self, whose
   * recipient swarm is our own and whose `sendState` already covers the only send there was.
   * Optional rather than defaulted, because `sent` here would claim a sync that never happened.
   */
  syncState?: SendState
  replyTo?: Reply
  deleted?: Deletion
}

/** A flattened AnyConversation: the fields every kind has, plus the DM-only ones. */
export interface Conversation {
  id: ConversationId
  kind: ConversationKind
  /** Empty until the other side's profile has arrived; callers fall back to the id. */
  displayName: string
  nickname?: string
  lastActivity: number
  priority: number
  /** A count on the conversation, never a flag on a message: libsession has no per-message unread. */
  unreadCount: number
  markedUnread: boolean
  snippet?: string
  muteUntil?: number
  request: boolean
  awaitingApproval: boolean
  noteToSelf: boolean
  blocked: boolean
}

export interface AccountInfo {
  haveAccount: boolean
  sessionId?: string
  displayName?: string
  networkAttached: boolean
}
