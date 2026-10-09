import { requirePorts } from '@session/app'
import { ALBUM_WIDTH } from '@session/basic-types'
import { useMemo, type ReactNode } from 'react'
import type { Attachment, Message } from '@session/client'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { AttachmentAlbum, type AlbumItem } from '@session/ui'

import type { Fetch } from './attachmentFetch'
import { viewableAttachments } from './viewableAttachments'

/**
 * One message's pictures, as an album.
 *
 * Everything that has to ask something is here: the urls come from the media port, the overflow
 * count from the catalogue, and `@session/ui` takes both already answered.
 */
export function MessageAlbum({
  message,
  onOpen,
  control,
  fetchFor,
}: {
  message: Message
  /** Takes the attachment's index in the message. */
  onOpen: (index: number) => void
  /** The set's own control, drawn over the box the layout names. */
  control?: ReactNode | undefined
  fetchFor: (attachment: Attachment) => Fetch
}) {
  const viewable = useMemo(() => viewableAttachments(message), [message])
  // Which a press would download rather than open: see `MessageAttachments`' `onOpen`.
  const fetchableKey = viewable
    .filter((attachment) => ['idle', 'failed'].includes(fetchFor(attachment).state))
    .map((attachment) => String(attachment.index))
    .join()
  // Memoised so the album's memoised tiles keep their items until the message changes.
  const items = useMemo((): AlbumItem[] => {
    const fetchable = new Set(fetchableKey.split(','))
    return viewable.map((attachment) => ({
      // The thumbnail, never the file: a tile is a few hundred pixels, and the viewer draws the
      // file. Until libsession has made one, the placeholder or the flat tile.
      uri: attachment.hasThumbnail
        ? requirePorts().media.thumbnailUrlFor({ messageId: message.id, index: attachment.index })
        : undefined,
      // Its own URL rather than pixels on the frame stream, so a placeholder reaches the
      // screen by the route a picture does. Null where the platform has no resolver.
      preview: attachment.hasPreview
        ? requirePorts().media.previewUrlFor({ messageId: message.id, index: attachment.index })
        : undefined,
      fetchesOnOpen: fetchable.has(String(attachment.index)),
      testID: ELEMENT.conversation.attachmentImage,
    }))
  }, [viewable, message.id, fetchableKey])

  return (
    <AttachmentAlbum
      items={items}
      width={ALBUM_WIDTH}
      overflowLabel={(count) => tr('andMore', { count })}
      onOpen={(at) => {
        const attachment = viewable[at]
        if (attachment !== undefined) onOpen(attachment.index)
      }}
      control={control}
      fetchLabel={tr('download')}
      fetchTestID={ELEMENT.conversation.attachmentFetch}
      testID={ELEMENT.conversation.attachment}
    />
  )
}
