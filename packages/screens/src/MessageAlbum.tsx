import { mediaKindOf } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { ReactNode } from 'react'
import type { AutoDownload, Message } from '@session/client'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { AttachmentAlbum, type AlbumItem } from '@session/ui'

import { mayResolve } from './autoDownload'
import { viewableAttachments } from './viewableAttachments'

/**
 * As wide as a bubble is allowed to be.
 *
 * A number here and not a constant shared with the bubble, because the bubble's own width is a
 * percentage of the pane and nothing measures it yet. When something does, this takes it as a
 * prop - the album has never been the thing that decides how wide a message is.
 */
export const ALBUM_WIDTH = 240

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
  autoDownload,
}: {
  message: Message
  /** Takes the attachment's index in the message. */
  onOpen: (index: number) => void
  /** The set's own control, drawn over the box the layout names. */
  control?: ReactNode
  /** What this conversation fetches unasked. Undefined means nobody has been asked. */
  autoDownload?: AutoDownload | undefined
}) {
  const viewable = viewableAttachments(message)

  const items: AlbumItem[] = viewable.map((attachment) => ({
    // Absent rather than null where this is not ours to fetch: null says the platform has no
    // resolver, and this says the person has not agreed to spend the data. Both draw the
    // placeholder, and the set's control is what offers to change it.
    ...(mayResolve(attachment, autoDownload)
      ? { uri: requirePorts().media.urlFor({ messageId: message.id, index: attachment.index }) }
      : {}),
    kind: mediaKindOf(attachment.contentType),
    // Its own URL rather than pixels on the frame stream, so a placeholder reaches the
    // screen by the route a picture does. Null where the platform has no resolver.
    ...(attachment.hasPreview
      ? {
          preview: requirePorts().media.previewUrlFor({
            messageId: message.id,
            index: attachment.index,
          }),
        }
      : {}),
    testID: ELEMENT.conversation.attachmentImage,
  }))

  return (
    <AttachmentAlbum
      items={items}
      width={ALBUM_WIDTH}
      overflowLabel={(count) => tr('andMore', { count })}
      onOpen={(at) => {
        const attachment = viewable[at]
        if (attachment !== undefined) onOpen(attachment.index)
      }}
      {...(control === undefined ? {} : { control })}
      testID={ELEMENT.conversation.attachment}
    />
  )
}
