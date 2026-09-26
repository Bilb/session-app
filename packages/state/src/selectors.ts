import type { AttachmentRef, AttachmentTransfer, ConversationId, Message } from '@session/client'

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
