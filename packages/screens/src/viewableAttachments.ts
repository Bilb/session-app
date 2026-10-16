import { isViewableImage } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { Attachment, Message } from '@session/client'
import type { MediaViewerItem } from '@session/ui'

/**
 * A whitelist rather than a prefix: `image/svg+xml`, `image/heic` and `image/tiff` are pictures no
 * renderer here draws reliably, and desktop refuses to serve anything outside the list. A video is
 * a file: libsession makes no thumbnail of one.
 */
export function isViewable(attachment: Attachment): boolean {
  return isViewableImage(attachment.contentType)
}

/**
 * Whether the viewer opens it: a viewable picture, or one libsession made a rendition of (AVIF,
 * HEIC where it decodes), unless its sender sent it as the original file, metadata and all, which
 * is only ever exported.
 */
export function opensInViewer(attachment: Attachment): boolean {
  return (isViewable(attachment) || attachment.hasRendition) && !attachment.originalFile
}

/**
 * Whether a file row leads with a picture rather than a glyph. libsession thumbnails some types
 * the viewer cannot open (AVIF), and its thumbnail is a JPEG every platform draws.
 */
export function leadsWithPicture(attachment: Attachment): boolean {
  return attachment.hasThumbnail || isViewable(attachment)
}

/**
 * The attachments on a message that a viewer can show.
 *
 * Wider than `Message.galleryViewable`: a message mixing a picture with a document is a list, and
 * its picture is still something somebody can open.
 *
 * Order is the message's own, so an index here is a position in the viewer and
 * `attachment.index` is the position in the message. Those are not the same number as soon as a
 * document sits between two pictures, and confusing them exports the wrong file.
 */
export function viewableAttachments(message: Message): Attachment[] {
  return message.attachments.filter(opensInViewer)
}

/**
 * What the viewer is handed to draw `attachment`, a url null where the platform has no resolver:
 * libsession's rendition once it has made one, else the file, never the thumbnail a tile draws.
 * The file stands behind a rendition that fails to load, where its own type is one we draw.
 * Export writes the file whichever is drawn.
 */
export function viewerItem(messageId: number, attachment: Attachment): MediaViewerItem {
  const ref = { messageId, index: attachment.index }
  const { media } = requirePorts()
  if (!attachment.hasRendition) return { uri: media.urlFor(ref) }
  return {
    uri: media.renditionUrlFor(ref),
    fallbackUri: isViewable(attachment) ? media.urlFor(ref) : undefined,
  }
}
