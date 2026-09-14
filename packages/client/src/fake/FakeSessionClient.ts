import { BridgeClosedError, SessionClientError } from '../errors'
import type {
  AccountInfo,
  Conversation,
  ConversationId,
  Deletion,
  Message,
  SessionEvent,
} from '@session/bridge-types'

import type { OutgoingMessage, SessionClient } from '../types'
import type { FakeAccount, FakeWorld } from './world'

/**
 * The fake behind the same interface the real bridge implements.
 *
 * Everything here is synchronous underneath; the promises exist because the interface has
 * them. Delivery and send-state transitions only happen when the world's clock is advanced,
 * so a test decides when time passes.
 */
export class FakeSessionClient implements SessionClient {
  private closed = false
  private readonly unsubscribes: Array<() => void> = []

  constructor(
    private readonly account: FakeAccount,
    private readonly world: FakeWorld,
  ) {}

  onEvent(listener: (event: SessionEvent) => void): () => void {
    const unsubscribe = this.account.subscribe(listener)
    this.unsubscribes.push(unsubscribe)
    return unsubscribe
  }

  private assertOpen(): void {
    if (this.closed) throw new BridgeClosedError()
  }

  getAccountInfo(): Promise<AccountInfo> {
    this.assertOpen()
    return Promise.resolve(this.account.accountInfo())
  }

  createAccount(): Promise<void> {
    this.assertOpen()
    this.account.haveAccount = true
    return Promise.resolve()
  }

  restoreAccount(
    from: { words: string[]; language?: string } | { hexSeed: string },
  ): Promise<void> {
    this.assertOpen()
    // The shim rejects a seed it cannot decode rather than guessing at one, so onboarding sees
    // the same refusal here as it will against libsession.
    if ('hexSeed' in from && !/^[0-9a-fA-F]{64}$/.test(from.hexSeed))
      return Promise.reject(new Error('hexSeed must be 32 bytes of hex'))
    this.account.haveAccount = true
    return Promise.resolve()
  }

  getSeedMnemonic(): Promise<string[]> {
    this.assertOpen()
    // libsession owns the real word list; the shape is what onboarding is written against.
    return Promise.resolve(
      'letters mumble ordeal jaded womanly framed jailed sifting january nurse gutter estate jaded'.split(
        ' ',
      ),
    )
  }

  setDisplayName(name: string): Promise<void> {
    this.assertOpen()
    this.account.displayName = name
    return Promise.resolve()
  }

  attachNetwork(): Promise<void> {
    this.assertOpen()
    this.account.networkAttached = true
    return Promise.resolve()
  }

  pollOnce(): Promise<void> {
    this.assertOpen()
    this.world.settle()
    return Promise.resolve()
  }

  getConversations(): Promise<Conversation[]> {
    this.assertOpen()
    return Promise.resolve(this.account.list())
  }

  getMessageRequests(): Promise<Conversation[]> {
    this.assertOpen()
    return Promise.resolve(this.account.requests())
  }

  getConversation(id: ConversationId): Promise<Conversation> {
    this.assertOpen()
    const conversation = this.account.get(id)
    if (!conversation) return Promise.reject(new SessionClientError(`No such conversation: ${id}`))
    return Promise.resolve(conversation)
  }

  openDm(sessionId: string): Promise<ConversationId> {
    this.assertOpen()
    const existing = this.account.get(sessionId)
    if (existing) return Promise.resolve(existing.id)

    const peer = this.world.find(sessionId)
    this.account.upsertConversation({
      id: sessionId,
      kind: 'dm',
      displayName: peer?.displayName ?? sessionId.slice(0, 8),
      lastActivity: this.world.now(),
      priority: 0,
      unreadCount: 0,
      markedUnread: false,
      request: false,
      awaitingApproval: false,
      noteToSelf: sessionId === this.account.sessionId,
      blocked: false,
    })
    return Promise.resolve(sessionId)
  }

  markRead(id: ConversationId): Promise<void> {
    this.assertOpen()
    this.account.markRead(id)
    return Promise.resolve()
  }

  setBlocked(id: ConversationId, blocked: boolean): Promise<void> {
    this.assertOpen()
    this.account.touch(id, { blocked })
    return Promise.resolve()
  }

  setNickname(id: ConversationId, nickname?: string): Promise<void> {
    this.assertOpen()
    const current = this.account.get(id)
    if (!current) return Promise.resolve()
    // Our own account is not a contact, so there is no entry to hold a nickname.
    if (current.noteToSelf) {
      return Promise.reject(
        new SessionClientError('setNickname: not applicable to your own account'),
      )
    }
    if (nickname === undefined) {
      const { nickname: _cleared, ...withoutNickname } = current
      this.account.replace(withoutNickname)
    } else {
      this.account.replace({ ...current, nickname })
    }
    return Promise.resolve()
  }

  setPriority(id: ConversationId, priority: number): Promise<void> {
    this.assertOpen()
    this.account.touch(id, { priority })
    return Promise.resolve()
  }

  approveConversation(id: ConversationId): Promise<void> {
    this.assertOpen()
    const conversation = this.account.get(id)
    if (!conversation) return Promise.resolve()
    // Goes through upsert so both lists are re-sent: the row moves, it is not re-added.
    this.account.upsertConversation({ ...conversation, request: false, awaitingApproval: false })
    return Promise.resolve()
  }

  deleteConversation(id: ConversationId): Promise<void> {
    this.assertOpen()
    this.account.removeConversation(id)
    return Promise.resolve()
  }

  getMessages(
    id: ConversationId,
    options?: {
      limit?: number
      before?: { timestamp: number; id: number }
      includeDeleted?: boolean
    },
  ): Promise<Message[]> {
    this.assertOpen()
    // A limit is a page size, not a sentinel: there is no value meaning "all of it", because
    // history grows without bound.
    if (options?.limit !== undefined && options.limit <= 0) {
      return Promise.reject(new SessionClientError('getMessages.limit must be greater than zero'))
    }
    // Deleted rows are dropped before the limit is applied, as libsession drops them in the
    // query: filtering a page after the fact would hand back short pages with nothing to say
    // that another page is warranted.
    const all = options?.includeDeleted
      ? this.account.messages(id)
      : this.account.messages(id).filter((m) => m.deleted === undefined)
    const before = options?.before
    const older = before
      ? all.filter(
          (m) =>
            m.timestamp < before.timestamp ||
            (m.timestamp === before.timestamp && m.id < before.id),
        )
      : all
    const limit = options?.limit ?? 50
    // Newest-first paging, returned oldest-first so a transcript can render it directly.
    return Promise.resolve(older.slice(Math.max(0, older.length - limit)))
  }

  sendMessage(id: ConversationId, message: OutgoingMessage): Promise<number> {
    this.assertOpen()
    return Promise.resolve(this.account.send(id, message.body, message.replyTo))
  }

  retrySend(): Promise<boolean> {
    this.assertOpen()
    return Promise.resolve(true)
  }

  deleteMessage(messageId: number, scope: Deletion): Promise<void> {
    this.assertOpen()
    for (const conversation of [...this.account.list(), ...this.account.requests()]) {
      const found = this.account.messages(conversation.id).find((m) => m.id === messageId)
      if (found) {
        this.account.updateMessage(conversation.id, messageId, { deleted: scope, body: '' })
        break
      }
    }
    return Promise.resolve()
  }

  getPref(key: string): Promise<string | undefined> {
    this.assertOpen()
    return Promise.resolve(this.account.getPref(key))
  }

  setPref(key: string, value: string): Promise<void> {
    this.assertOpen()
    this.account.setPref(key, value)
    return Promise.resolve()
  }

  close(): void {
    this.closed = true
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.unsubscribes.length = 0
  }

  /**
   * Stops this client and opens a new one on the same data, the way relaunching the app
   * would. Anything still in flight comes back interrupted.
   */
  restart(): FakeSessionClient {
    this.close()
    this.account.restart()
    return new FakeSessionClient(this.account, this.world)
  }
}
