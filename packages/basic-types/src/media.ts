export type MediaKind = 'image' | 'video'

/**
 * The image types every renderer draws inline. SVG is deliberately out: it is a script-capable
 * document rather than a bitmap, and native image views do not draw it. `image/jpg` is not a
 * registered type, but senders send it.
 */
const VIEWABLE_IMAGE: ReadonlySet<string> = new Set([
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/apng',
  'image/webp',
])

const VIEWABLE_VIDEO: ReadonlySet<string> = new Set(['video/mp4', 'video/webm', 'video/ogg'])

// The six characters the shim's essence() strips; trim() would also take Unicode space and a BOM.
const ASCII_EDGE_SPACE = /^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g

/** `Image/JPEG; charset=binary` → `image/jpeg`: a declared type is compared by its essence only. */
function essence(contentType: string | undefined): string | undefined {
  return contentType?.split(';')[0]?.replace(ASCII_EDGE_SPACE, '').toLowerCase()
}

/**
 * libsession's `image::is_displayable_image`: what it shows as a gallery, what `image-attachments`
 * fetches unasked, and what it makes a thumbnail of. Its list and its comparison, which folds ASCII
 * case and nothing else: no parameters, no space trimmed.
 */
const DISPLAYABLE_IMAGE: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

export function isDisplayableImage(contentType: string | undefined): boolean {
  if (contentType === undefined) return false
  return DISPLAYABLE_IMAGE.has(contentType.replace(/[A-Z]/g, (c) => c.toLowerCase()))
}

export function isViewableImage(contentType: string | undefined): boolean {
  const type = essence(contentType)
  return type !== undefined && VIEWABLE_IMAGE.has(type)
}

export function isViewableVideo(contentType: string | undefined): boolean {
  const type = essence(contentType)
  return type !== undefined && VIEWABLE_VIDEO.has(type)
}

export function isViewableContentType(contentType: string | undefined): boolean {
  return isViewableImage(contentType) || isViewableVideo(contentType)
}

/** Only meaningful for a viewable type, which a caller checks first. */
export function mediaKindOf(contentType: string | undefined): MediaKind {
  return isViewableVideo(contentType) ? 'video' : 'image'
}
