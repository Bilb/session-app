import type { Message } from '@session/client'
import { YStack } from '@session/ui'

import { AttachmentFooter } from './AttachmentFooter'
import { AttachmentList, LIST_MAX_ROWS } from './AttachmentList'
import { AttachmentPill } from './AttachmentPill'
import { attachmentView, canChooseView } from './attachmentView'
import { useConversationUi } from './conversationUi'
import { MessageAlbum } from './MessageAlbum'
import { useAttachmentSet } from './useAttachmentSet'

/**
 * Everything one message's attachments draw: the album or the list, and the one footer under both.
 *
 * The footer is the set's, not either shape's - its count is every attachment, including the ones
 * behind "+N" that no tile shows.
 */
export function MessageAttachments({ message }: { message: Message }) {
  const ui = useConversationUi()
  const { set, act, downloadMissing } = useAttachmentSet(message)
  const view = attachmentView(message, ui.viewFor(message.id))
  const overflows = view === 'list' && message.attachments.length > LIST_MAX_ROWS

  // Once rather than per shape: a message with nothing attached would otherwise draw an empty
  // album, because "every attachment can be shown" is true of no attachments at all.
  if (message.attachments.length === 0) return null

  return (
    <YStack gap="$3xs">
      {view === 'gallery' ? (
        <MessageAlbum
          message={message}
          autoDownload={ui.autoDownload}
          // A tile is the whole set's, so tapping one fetches every attachment the album stands
          // for; a row in the list fetches only its own.
          onOpen={(index) => {
            downloadMissing()
            ui.openViewer(message.id, index)
          }}
          control={<AttachmentPill set={set} />}
        />
      ) : (
        <AttachmentList
          message={message}
          onShowAll={
            overflows
              ? () => {
                  ui.openSheet(message.id)
                }
              : undefined
          }
        />
      )}
      <AttachmentFooter
        set={set}
        onAction={act}
        view={canChooseView(message) ? view : undefined}
        onView={(chosen) => {
          ui.chooseView(message.id, chosen)
        }}
      />
    </YStack>
  )
}
