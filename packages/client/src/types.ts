/**
 * What the app sees of libsession.
 *
 * One interface, three implementations: the Nitro module on mobile, the addon behind the
 * preload bridge on desktop, and the fake. Screens and stores are written against this and
 * cannot tell which one they have.
 *
 * The data types live in `@session/bridge-types`, which is also what the C++ is generated from,
 * so what a screen renders and what the shim fills are one declaration.
 */

import type {
  AccountInfo,
  AttachmentProgress,
  Conversation,
  ConversationId,
  Deletion,
  Frame,
  Message,
  MessageCursor,
  OutgoingAttachment,
  Request,
  SessionEvent,
} from '@session/bridge-types'

export type ProgressCallback = (progress: AttachmentProgress) => void

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

  getPref(key: string): Promise<string | undefined>
  setPref(key: string, value: string): Promise<void>

  close(): void
}

/** What a platform binding has to provide. Everything else is shared. */
export interface BridgeTransport {
  /** Submit a request. The reply arrives on the frame stream, not from here. */
  send(request: Request): void
  setSink(onFrame: (frame: Frame) => void): void
  close(): void
}
