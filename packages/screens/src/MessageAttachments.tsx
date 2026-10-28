import { ALBUM_WIDTH } from '@session/basic-types'
import type { Attachment, Message } from '@session/client'
import { SPACE_SCALE, YStack } from '@session/ui'
import { useSessionActions } from '@session/state'
import { useState } from 'react'

import { AttachmentFooter, ROW_OVERHANG } from './AttachmentFooter'
import { AttachmentList, LIST_MAX_ROWS } from './AttachmentList'
import { AttachmentPill } from './AttachmentPill'
import { attachmentView, canChooseView } from './attachmentView'
import { useConversationUi } from './conversationUi'
import { exportOne } from './exportAttachment'
import { MessageAlbum } from './MessageAlbum'
import { isUploadPhase, whileSending } from './uploadState'
import { useAttachmentFooter } from './useAttachmentFooter'
import { useAttachmentSet } from './useAttachmentSet'
import { useExportFeedback } from './useExportFeedback'
import { viewerFit } from './viewableAttachments'

/**
 * Everything one message's attachments draw: the album or the list, and the one footer under both.
 *
 * The footer is the set's, not either shape's - its count is every attachment, including the ones
 * behind "+N" that no tile shows.
 */
export function MessageAttachments({ message }: { message: Message }) {
  const ui = useConversationUi()
  const actions = useSessionActions()
  const feedback = useExportFeedback()
  const attachmentSet = useAttachmentSet(message)
  const { set, fetchFor, downloadMissing } = attachmentSet
  const footer = useAttachmentFooter(message, attachmentSet)
  const view = attachmentView(message)
  const overflows = view === 'list' && message.attachments.length > LIST_MAX_ROWS
  const sending = isUploadPhase(message)
  const albumFetch = sending
    ? (attachment: Attachment) => whileSending(fetchFor(attachment))
    : fetchFor
  // The album lays its tiles out from a number, so it is told the room the bubble left rather
  // than drawn at ALBUM_WIDTH and clipped by a bubble narrower than that.
  const [albumWidthPx, setAlbumWidthPx] = useState(ALBUM_WIDTH)

  // Once rather than per shape: a message with nothing attached would otherwise draw an empty
  // album, because "every attachment can be shown" is true of no attachments at all.
  if (message.attachments.length === 0) return null

  return (
    // One width in either shape: a bubble fits its content, so a list left to size itself gives
    // its names and the footer's total no width at all, and the bubble would resize on a toggle.
    // Capped at the bubble's inside, so where a pane is too narrow the list shrinks instead.
    // The gap clears the footer's overhang, so a tile or row is never under the footer's targets.
    // Wider under a gallery, whose pictures run edge to edge and would otherwise touch its buttons.
    <YStack
      gap={SPACE_SCALE[view === 'gallery' ? 'xs' : '3xs'] + ROW_OVERHANG}
      width={ALBUM_WIDTH}
      maxWidth="100%"
      onLayout={(event) => {
        setAlbumWidthPx(Math.min(ALBUM_WIDTH, Math.floor(event.nativeEvent.layout.width)))
      }}
    >
      {view === 'gallery' ? (
        <MessageAlbum
          message={message}
          widthPx={albumWidthPx}
          onAccent={message.outgoing}
          fetchFor={albumFetch}
          setState={set.state}
          // Opens only a picture that is here, as the legacy clients do, and exports one sent as
          // the original file. A tile is the whole set's, so tapping one that is not here fetches
          // every attachment the album stands for.
          onOpen={(index) => {
            const tapped = message.attachments.find((a) => a.index === index)
            if (tapped !== undefined && albumFetch(tapped).state === 'ready') {
              const fit = viewerFit(tapped)
              if (fit === 'opens') ui.openViewer(message.id, index)
              else if (fit === 'exports' && !sending)
                void exportOne(message, index, actions, feedback)
            } else if (!sending) downloadMissing()
          }}
          // The pill is the download's: while sending, the footer's count says the same.
          control={sending ? undefined : <AttachmentPill set={set} />}
        />
      ) : (
        <AttachmentList
          message={message}
          onAccent={message.outgoing}
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
        onAccent={message.outgoing}
        onAction={footer.onAction}
        sending={footer.sending}
        view={canChooseView(message) ? view : undefined}
        onView={(chosen) => {
          // Nothing redraws until libsession announces it, so a failure still shows what is stored.
          void actions.setGallery(message.id, chosen === 'gallery').catch(() => undefined)
        }}
      />
    </YStack>
  )
}
