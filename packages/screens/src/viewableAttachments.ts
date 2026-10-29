import { isDisplayableImage, isViewableImage } from '@session/basic-types'
import { requirePorts } from '@session/app'
import type { Attachment, Message } from '@session/client'
import type { MediaViewerItem } from '@session/ui'

import type { FetchState } from './attachmentFetch'

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
 * (AVIF). A picture libsession can make one of but has not yet awaits it: libsession makes one only
 * when asked, so the viewer opens on it and asks. One its sender sent as the original file,
 * metadata and all, exports.
 */
export type ViewerFit = 'opens' | 'awaitsRendition' | 'exports'

export function viewerFit(attachment: Attachment): ViewerFit {
  if (attachment.originalFile) return 'exports'
  if (isViewable(attachment) || attachment.hasRendition) return 'opens'
  return isDisplayableImage(attachment.contentType) ? 'awaitsRendition' : 'exports'
}

/** Whether a tap shows it in the viewer: one it opens now, or one whose rendition it asks for. */
export function opensInViewer(attachment: Attachment): boolean {
  return viewerFit(attachment) !== 'exports'
}

/**
 * Whether a file row leads with a picture rather than a glyph: anything libsession thumbnailed,
 * which includes types the viewer cannot open, and anything the viewer can.
 */
export function leadsWithPicture(attachment: Attachment): boolean {
  return attachment.hasThumbnail || isViewable(attachment)
}

/**
 * What a row square or an album tile draws: libsession's thumbnail, else the file once it is here
 * where it is viewable but of a type libsession never thumbnails (BMP), else nothing and the
 * placeholder stays. A type libsession does thumbnail waits for it rather than decode the file,
 * except a file of ours still uploading: libsession thumbnails only what is in its cache, which a
 * sent file joins once it is up, so until then the tile draws libsession's own copy.
 */
export function leadUri(
  messageId: number,
  attachment: Attachment,
  state: FetchState,
): string | null | undefined {
  const ref = { messageId, index: attachment.index }
  if (attachment.hasThumbnail) return requirePorts().media.thumbnailUrlFor(ref)
  if (
    state === 'ready' &&
    isViewable(attachment) &&
    (!attachment.uploaded || !isDisplayableImage(attachment.contentType))
  )
    return requirePorts().media.urlFor(ref)
  return undefined
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
  // libsession makes a rendition only when one is asked for, and loading its url is the ask.
  if (viewerFit(attachment) === 'awaitsRendition')
    return { uri: null, preparing: media.renditionUrlFor(ref) }
  if (!attachment.hasRendition) return { uri: media.urlFor(ref) }
  return {
    uri: media.renditionUrlFor(ref),
    fallbackUri: isViewable(attachment) ? media.urlFor(ref) : undefined,
  }
}

/** An item an open viewer holds, and whether it was made with a rendition to draw. */
export interface HeldItem {
  item: MediaViewerItem
  hadRendition: boolean
}

/**
 * The item an open viewer was first handed for `key`, so a rendition evicted mid-view does not
 * swap the url under a drawn picture, which blanks a frame on native. A rendition landing replaces
 * an item made without one, once: it can replace what was drawn first, such as desktop's thumbnail.
 */
export function heldItem(
  held: Map<string, HeldItem>,
  key: string,
  hasRendition: boolean,
  make: () => MediaViewerItem,
): MediaViewerItem {
  const kept = held.get(key)
  if (kept !== undefined && (kept.hadRendition || !hasRendition)) return kept.item
  const item = make()
  held.set(key, { item, hadRendition: hasRendition })
  return item
}
