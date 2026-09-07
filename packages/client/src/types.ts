/**
 * What the app sees of libsession.
 *
 * One interface, three implementations: the Nitro module on mobile, the addon behind the
 * preload bridge on desktop, and the fake. Screens and stores are written against this and
 * cannot tell which one they have.
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
  /** On the file server - not "the bytes are here". libsession does not record a local path. */
  uploaded: boolean
}

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
  sendState: SendState
  attachments: Attachment[]
  replyTo?: Reply
  deleted?: Deletion
}

export interface Conversation {
  id: ConversationId
  kind: ConversationKind
  displayName: string
  nickname?: string
  lastActivity: number
  priority: number
  unreadCount: number
  markedUnread: boolean
  snippet?: string
  muteUntil?: number
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
 * finished - `done === total` does not. Reports for one index are ordered and exactly one
 * carries a result; different indexes interleave.
 */
export interface AttachmentProgress {
  messageId: number
  index: number
  done: number
  total: number
  result?: number
}

export type ProgressCallback = (progress: AttachmentProgress) => void

export type SessionEvent =
  | { type: 'conversation-added'; conversation: Conversation }
  | { type: 'conversation-updated'; conversation: Conversation }
  | { type: 'conversation-removed'; conversationId: ConversationId }
  | { type: 'conversation-list-replaced'; conversations: Conversation[] }
  | { type: 'request-list-replaced'; conversations: Conversation[] }
  | { type: 'message-added'; conversationId: ConversationId; message: Message }
  | { type: 'message-updated'; conversationId: ConversationId; message: Message }
  | { type: 'history-replaced'; conversationId: ConversationId }
  | {
      type: 'attachment-progress'
      /** Set when libsession fetched it unprompted; absent when a command asked for it. */
      conversationId?: ConversationId
      progress: AttachmentProgress
    }
  | {
      type: 'display-picture-progress'
      conversationId: ConversationId
      done: number
      total: number
      result?: number
    }
  | { type: 'log'; message: string; category: string; level: string }

export type Unsubscribe = () => void

export interface OutgoingMessage {
  body: string
  attachments?: OutgoingAttachment[]
  replyTo?: number
}

export interface SessionClient {
  /** Events arrive in the order libsession produced them, responses interleaved in place. */
  onEvent(listener: (event: SessionEvent) => void): Unsubscribe

  getAccountInfo(): Promise<AccountInfo>
  createAccount(): Promise<void>
  restoreAccount(from: { words: string[]; language?: string } | { hexSeed: string }): Promise<void>
  /** libsession owns the word list, so onboarding needs no mnemonic library of its own. */
  getSeedMnemonic(language?: string): Promise<string[]>
  setDisplayName(name: string): Promise<void>
  attachNetwork(netid: string, devnetSeedUrl?: string): Promise<void>
  /** One poll cycle, run to completion - what every OS background budget wants. */
  pollOnce(): Promise<void>

  getConversations(): Promise<Conversation[]>
  getMessageRequests(): Promise<Conversation[]>
  getConversation(id: ConversationId): Promise<Conversation>
  openDm(sessionId: string): Promise<ConversationId>
  markRead(id: ConversationId, upTo?: number): Promise<void>
  setBlocked(id: ConversationId, blocked: boolean): Promise<void>
  setNickname(id: ConversationId, nickname?: string): Promise<void>
  setPriority(id: ConversationId, priority: number): Promise<void>
  approveConversation(id: ConversationId): Promise<void>
  deleteConversation(id: ConversationId, keepMessages?: boolean): Promise<void>

  getMessages(
    id: ConversationId,
    options?: { limit?: number; before?: MessageCursor; includeDeleted?: boolean },
  ): Promise<Message[]>
  /**
   * Resolves as soon as libsession has stored the row - which is before it is sent, and
   * before any attachment has uploaded. The states that follow arrive as message-updated.
   */
  sendMessage(
    id: ConversationId,
    message: OutgoingMessage,
    options?: { onUploadProgress?: ProgressCallback },
  ): Promise<number>
  /** Resumes rather than restarts: files already uploaded are not sent again. */
  retrySend(messageId: number, options?: { onUploadProgress?: ProgressCallback }): Promise<boolean>
  deleteMessage(messageId: number, scope: Deletion): Promise<void>

  attachmentData(
    messageId: number,
    index: number,
    options?: { onProgress?: ProgressCallback },
  ): Promise<Uint8Array>
  /** Returns where the file actually landed, which may not be the name that was asked for. */
  saveAttachment(
    messageId: number,
    index: number,
    destination: string,
    options?: { notifySender?: boolean; replace?: boolean; onProgress?: ProgressCallback },
  ): Promise<string>

  getPref(key: string): Promise<string | undefined>
  setPref(key: string, value: string): Promise<void>

  close(): void
}

/** What a platform binding has to provide. Everything else is shared. */
export interface BridgeTransport {
  /** Submit an encoded Request. The reply arrives on the frame stream, not from here. */
  send(request: Uint8Array): void
  setSink(onFrame: (frame: Uint8Array) => void): void
  close(): void
}
