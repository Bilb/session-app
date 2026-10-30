import type { Attachment } from '@session/client'

/** libsession crops a thumbnail to its centre past 21:9, either way up. */
const THUMBNAIL_MAX_ASPECT = 21 / 9

/**
 * How far the sender's shape may differ from the thumbnail's and still be the same picture: the
 * thumbnail's rounding to whole pixels, with room to spare.
 */
const SAME_SHAPE_TOLERANCE = 0.02

function ratio(width: number | undefined, height: number | undefined): number | undefined {
  if (width === undefined || height === undefined) return undefined
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    return undefined
  return width / height
}

function hashed(aspect: number | undefined): number | undefined {
  return aspect !== undefined && Number.isFinite(aspect) && aspect > 0 ? aspect : undefined
}

/**
 * The shape, width over height, an album lays an attachment's tile out at, or undefined for a
 * square.
 *
 * The sender's `width` and `height` first, since they are known before a byte arrives and the
 * tile then never moves. libsession's thumbnail, which is made upright, takes over where the sender
 * gave none, or gave a shape the thumbnail contradicts - a sideways one from a client that did not
 * apply the EXIF orientation - since that is what the tile draws. Where the two agree the sender's
 * stays, so a tile drawn before the download keeps its rect after it.
 *
 * With neither, the ThumbHash's own record of the shape, which is coarse (a 4:3 photograph reads
 * 7:5) but is there before the download, so the tile moves at most once, when the thumbnail lands.
 */
export function albumAspect(attachment: Attachment): number | undefined {
  const sent = ratio(attachment.width, attachment.height)
  const drawn = attachment.hasThumbnail
    ? ratio(attachment.thumbnailWidthPx, attachment.thumbnailHeightPx)
    : undefined
  if (drawn === undefined) return sent ?? hashed(attachment.thumbhashAspect)
  if (sent === undefined) return drawn
  const cropped = Math.min(THUMBNAIL_MAX_ASPECT, Math.max(1 / THUMBNAIL_MAX_ASPECT, sent))
  return Math.abs(Math.log(cropped / drawn)) <= Math.log1p(SAME_SHAPE_TOLERANCE) ? sent : drawn
}
