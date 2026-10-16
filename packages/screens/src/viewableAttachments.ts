import { isDisplayableImage, isViewableImage } from '@session/basic-types'
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
 * What the viewer makes of it: it opens a viewable picture, or one libsession made a rendition of
 * (AVIF). A picture libsession will make one of but has not yet awaits it, so its tap does not
 * export first and open later. One its sender sent as the original file, metadata and all, exports.
 */
export type ViewerFit = 'opens' | 'awaitsRendition' | 'exports'

export function viewerFit(attachment: Attachment): ViewerFit {
  if (attachment.originalFile) return 'exports'
  if (isViewable(attachment) || attachment.hasRendition) return 'opens'
  return isDisplayableImage(attachment.contentType) ? 'awaitsRendition' : 'exports'
}

export function opensInViewer(attachment: Attachment): boolean {
  return viewerFit(attachment) === 'opens'
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
