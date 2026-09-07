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

/** Mirrors libsession's own send-state machine, value for value. */
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

export type AutoDownload = 'none' | 'image-attachments' | 'all'

/**
 * Where a page of history starts. Newest-first, keyed by (timestamp, id) so that a page seam
 * cannot duplicate or skip a message that shares a timestamp with its neighbour.
 */
export interface MessageCursor {
  timestamp: number
  id: number
}

export interface Attachment {
  index: number
  contentType?: string
  filename?: string
  caption?: string
  /** Unset until an outgoing attachment has uploaded; a sender's claim on an incoming one. */
  size?: number
  voiceMessage: boolean
  width?: number
  height?: number
  /**
   * On the file server: an outgoing attachment's upload finished, and always true for an
   * incoming one. Deliberately not "the bytes are here" - libsession records no local path,
   * because the application chose it and a stored copy would go stale the moment the file moved.
   */
  uploaded: boolean
}

/** A file being attached to a message that has not been sent yet. */
export interface OutgoingAttachment {
  path: string
  contentType?: string
  filename?: string
  caption?: string
  voiceMessage?: boolean
  /** libsession does not measure the image; whoever picked the file supplies these. */
  width?: number
  height?: number
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
  /** Incoming messages have no send state of their own and report `sent`. */
  sendState: SendState
  attachments: Attachment[]
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
  /** Unset upstream means "inherit the account default" and crosses as `none`; no screen offers the distinction. */
  autoDownload: AutoDownload
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

/**
 * One report about one attachment transfer.
 *
 * The first report of a transfer is `{done: 0, total: 0}` and means it started. `result`
 * absent means still going; `result === 0` means accepted and is the only thing that means
 * finished - `done === total` does not. Any other value is a failure: a file server status, a
 * negative network code, or one of the sentinels below. Reports for one index are ordered and
 * exactly one carries a result; different indexes interleave.
 */
export interface AttachmentProgress {
  messageId: number
  index: number
  done: number
  total: number
  result?: number
}

export const ATTACHMENT_OK = 0
export const ATTACHMENT_FILE_MISSING = -20001
export const ATTACHMENT_UNREADABLE = -20002
