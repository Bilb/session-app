import type {
  AccountInfo,
  Conversation,
  ConversationId,
  Deletion,
  Message,
  MessageCursor,
} from './domain'
import type { FileServerConfig, SeedNode } from './sessionBridgeOptions'

/**
 * The bridge protocol: what goes in, what comes out, on one ordered stream.
 *
 * Responses ride the same stream as change events rather than resolving on a separate channel,
 * because their relative order is load-bearing. libsession's contract is that a display can be
 * built by asking once and then applying events; that only holds if a list_replaced produced
 * before the answer to getConversations is also applied before it. Two channels - a promise and
 * a callback - give no such guarantee across an IPC or JSI boundary, and the failure would be a
 * stale row that reappears on a race nobody can reproduce. One FIFO stream carries libsession's
 * own ordering through to TypeScript; the facade still hands callers promises, resolved from
 * `Response` frames.
 *
 * Every union here is discriminated on a literal `type`, and every field is a string, number,
 * boolean, string-union enum, another interface, or an array of one: that is the subset the C++
 * generator understands, and it refuses anything else.
 */

/**
 * Everything the app asks libsession to do. One Request goes in, exactly one Response comes
 * back carrying the same id. Commands are named for what the app wants, not for the C++ method
 * that serves them, so that a refactor upstream is a shim change rather than a protocol change.
 */
export type Command =
  // Lifecycle and account
  | { type: 'getAccountInfo' }
  | { type: 'createAccount' }
  | { type: 'restoreAccountFromWords'; words: string[]; language?: string }
  | { type: 'restoreAccountFromSeed'; hexSeed: string }
  | { type: 'getSeedMnemonic'; language?: string }
  | { type: 'setDisplayName'; name: string }
  /**
   * Attach a network, or replace the one attached. Declining to attach is how an app stays
   * offline, and that is an init option rather than a command.
   *
   * Carries everything the network needs rather than leaving half of it remembered from init, so
   * that a refusal leaves the client on whatever it had. "mainnet", "testnet" or "devnet".
   */
  | { type: 'attachNetwork'; netid: string; seedNodes?: SeedNode[]; fileServer?: FileServerConfig }
  /**
   * Run one poll cycle to completion: the primitive every OS background budget wants. Android's
   * WorkManager job, iOS's BGAppRefreshTask and a push-triggered fetch all reduce to it.
   */
  | { type: 'pollOnce' }
  | { type: 'setPushToken'; platform: string; token: string }
  /**
   * Interpret a push payload far enough to notify. Answering from the payload alone matters on
   * iOS, where the notification service extension runs while the app holds the database.
   */
  | { type: 'handlePushPayload'; payloadHex: string }
  // Conversations
  | { type: 'getConversations' }
  | { type: 'getMessageRequests' }
  | { type: 'getConversation'; conversationId: ConversationId }
  | { type: 'openDm'; sessionId: string }
  | { type: 'markRead'; conversationId: ConversationId; upTo?: number }
  | { type: 'setBlocked'; conversationId: ConversationId; blocked: boolean }
  | { type: 'setNickname'; conversationId: ConversationId; nickname?: string }
  | { type: 'setPriority'; conversationId: ConversationId; priority: number }
  | { type: 'approveConversation'; conversationId: ConversationId }
  | { type: 'deleteConversation'; conversationId: ConversationId; keepMessages: boolean }
  // Messages
  | {
      type: 'getMessages'
      conversationId: ConversationId
      limit: number
      before?: MessageCursor
      includeDeleted: boolean
    }
  | { type: 'sendMessage'; conversationId: ConversationId; body: string; replyTo?: number }
  | { type: 'retrySend'; messageId: number }
  | { type: 'deleteMessage'; messageId: number; scope: Deletion }
  // App preferences, stored in libsession's globals table so they sit beside the account
  // instead of in a second store the app would have to keep in step.
  | { type: 'getPref'; key: string }
  | { type: 'setPref'; key: string; value: string }
  // Served by the shim only under SESSION_BRIDGE_TESTING; every other build answers with an
  // error naming the command. These are what let the contract suite drive the real bridge with
  // no network: one client's messages are carried to the other by the harness, encrypted and fed
  // in the way the swarm would have done it. A port of libsession's own test helpers
  // (tests/test_client/common.hpp), not a second way to do anything the app does.
  /**
   * Builds, encrypts and delivers a v1 DM as if it had arrived from the swarm. The sender is
   * whoever holds `senderSeedHex`, a 32-byte account seed; the recipient is always the client
   * the command is sent to, since that is the only account it can decrypt for.
   */
  | { type: 'deliverTestMessage'; senderSeedHex: string; body: string; timestamp: number }
  /** This client's own account seed, so the harness can forge messages from it to another. */
  | { type: 'getTestAccountSeed' }
  /**
   * Marks a contact approved, which is what having written to them would have done. Setup for
   * scenarios about something else: without it a first message is a request and the list the
   * test asks about is empty.
   */
  | { type: 'approveTestContact'; sessionId: string }
  /**
   * Emits the given frame verbatim onto the stream. Every converter in both directions runs on
   * every field of every output type, which is the round-trip test of the generated C++.
   */
  | { type: 'echoTestFrame'; frame: Frame }

export interface Request {
  id: number
  command: Command
}

/** What a Response carries when the command succeeded. */
export type Result =
  | { type: 'empty' }
  | { type: 'accountInfo'; info: AccountInfo }
  | { type: 'mnemonic'; words: string[] }
  | { type: 'conversationList'; conversations: Conversation[] }
  | { type: 'conversation'; conversation: Conversation }
  /**
   * Oldest first, whatever page it is - the direction a transcript is read. libsession answers
   * newest first because that is the direction paging runs; the shim reverses. Getting this
   * wrong shows up as a conversation that reads bottom to top.
   */
  | { type: 'messageList'; messages: Message[] }
  | { type: 'messageId'; messageId: number }
  | { type: 'hex'; hex: string }
  | { type: 'pref'; value?: string }
  | { type: 'bool'; value: boolean }

export interface Response {
  id: number
  /**
   * libsession reports failures as text - usually SQLite's own message. Deliberately not an
   * enum: the message says which constraint, and inventing codes would throw that away. Set
   * instead of `result`, never beside it.
   */
  error?: string
  result?: Result
}

/**
 * Change notifications, one per libsession callback, and what `SessionClient.onEvent` delivers.
 *
 * Every one of these carries the whole new state rather than an id to go and fetch. That is what
 * makes a display bindable, applying the same event twice harmless, and startup race-free:
 * whatever arrives between construction and the first query lands on top of the answer without
 * contradicting it.
 *
 * The shim emits these and the app reads them, with nothing in between rewriting an arm - which
 * is why there is one type rather than a wire one and an app one.
 */
export type SessionEvent =
  | { type: 'conversation-added'; conversation: Conversation }
  | { type: 'conversation-updated'; conversation: Conversation }
  | { type: 'conversation-removed'; conversationId: ConversationId }
  | { type: 'conversation-list-replaced'; conversations: Conversation[] }
  | { type: 'request-list-replaced'; conversations: Conversation[] }
  | { type: 'message-added'; conversationId: ConversationId; message: Message }
  | { type: 'message-updated'; conversationId: ConversationId; message: Message }
  | { type: 'history-replaced'; conversationId: ConversationId }
  /**
   * libsession's own log lines, forwarded when the bridge was opened with a log level. Worth
   * having because the state machine reports what happened and never why.
   */
  | { type: 'log'; message: string; category: string; level: string }

/** Everything the shim sends back, in the order libsession produced it. */
export type Frame =
  { type: 'response'; response: Response } | { type: 'event'; event: SessionEvent }
