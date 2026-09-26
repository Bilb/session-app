import type { ConversationId, Message } from '@session/client'
import { tr } from '@session/localization'
import { useMessage } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Sheet } from '@session/ui'
import { useRef } from 'react'

import { AttachmentFooter } from './AttachmentFooter'
import { AttachmentList } from './AttachmentList'
import { useAttachmentSet } from './useAttachmentSet'

function SheetFooter({ message }: { message: Message }) {
  const { set, act } = useAttachmentSet(message)
  return <AttachmentFooter set={set} onAction={act} />
}

function MessageSheet({
  conversationId,
  messageId,
  open,
  onClose,
}: {
  conversationId: ConversationId
  messageId: number
  open: boolean
  onClose: () => void
}) {
  const message = useMessage(conversationId, messageId)
  return (
    <Sheet
      open={open && message !== undefined}
      onClose={onClose}
      title={tr('attachments')}
      closeLabel={tr('close')}
      footer={message === undefined ? undefined : <SheetFooter message={message} />}
      testID={ELEMENT.conversation.attachmentSheet}
      closeTestID={ELEMENT.conversation.attachmentSheetClose}
    >
      {message === undefined ? null : <AttachmentList message={message} />}
    </Sheet>
  )
}

/**
 * Every attachment of one message, on a surface that can be as tall as it needs to be.
 *
 * The same rows and the same footer as the transcript. No toggle in here: the sheet is the list,
 * and a control offering to make it a gallery would be offering to empty what was just opened.
 */
export function AttachmentSheet({
  conversationId,
  messageId,
  onClose,
}: {
  conversationId: ConversationId
  /** Null when closed. */
  messageId: number | null
  onClose: () => void
}) {
  // Held past closing, so the sheet animates shut with its rows still in it.
  const last = useRef<number | null>(null)
  if (messageId !== null) last.current = messageId
  const shown = messageId ?? last.current
  if (shown === null) return null
  return (
    <MessageSheet
      conversationId={conversationId}
      messageId={shown}
      open={messageId !== null}
      onClose={onClose}
    />
  )
}
