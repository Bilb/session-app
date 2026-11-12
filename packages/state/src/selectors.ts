import type {
  AttachmentRef,
  AttachmentTransfer,
  Conversation,
  ConversationId,
  Message,
} from '@session/client'

import type { AttachmentTransferState, MessageTransfers, SessionState } from './types'
import { transferKey } from './types'

// Shared so a message with no transfers selects the same object every time.
const NO_TRANSFERS: MessageTransfers = {}

export function selectMessageTransfers(state: SessionState, messageId: number): MessageTransfers {
  return state.transfers[messageId] ?? NO_TRANSFERS
}

export function selectAttachmentTransfer(
  state: SessionState,
  transfer: AttachmentTransfer,
  ref: AttachmentRef,
): AttachmentTransferState | undefined {
  return state.transfers[ref.messageId]?.[transferKey(transfer, ref.index)]
}

export function selectMessage(
  state: SessionState,
  conversationId: ConversationId,
  messageId: number,
): Message | undefined {
  return state.histories[conversationId]?.messages.find((m) => m.id === messageId)
}

/**
 * A selector for one conversation, in whichever list holds it.
 *
 * It searches only when a list changed. A selector runs on every store notification, and most of
 * those (a transfer's progress, a message) leave both lists as they were.
 */
export function conversationSelector(
  id: ConversationId | undefined,
): (state: SessionState) => Conversation | undefined {
  let conversations: Conversation[] | undefined
  let requests: Conversation[] | undefined
  let found: Conversation | undefined
  return (state) => {
    if (id === undefined) return undefined
    if (state.conversations !== conversations || state.requests !== requests) {
      conversations = state.conversations
      requests = state.requests
      found = conversations.find((c) => c.id === id) ?? requests.find((c) => c.id === id)
    }
    return found
  }
}

let countedIn: Conversation[] | undefined
let unreadRequests = 0

/** Unread requests, counted again only when the request list changed. */
export function selectUnreadRequestCount(state: SessionState): number {
  if (state.requests !== countedIn) {
    countedIn = state.requests
    unreadRequests = 0
    for (const request of countedIn) if (request.unreadCount > 0) unreadRequests += 1
  }
  return unreadRequests
}
