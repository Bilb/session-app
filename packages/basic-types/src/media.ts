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
  'image/webp',
])

const VIEWABLE_VIDEO: ReadonlySet<string> = new Set(['video/mp4', 'video/webm', 'video/ogg'])

// Space, tab, CR and LF alone, as the shim trims: trim() would also take \f, \v and a BOM.
const EDGE_SPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g

/**
 * `Image/JPEG; charset=binary` → `image/jpeg`: a declared type is compared by its essence only,
 * which ends at a `;` and folds ASCII case alone. An embedded NUL is kept, so it matches no list.
 */
export function contentTypeEssence(contentType: string | undefined): string | undefined {
  return contentType
    ?.split(';')[0]
    ?.replace(EDGE_SPACE, '')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
}

/**
 * libsession's `image::is_displayable_image`: what it shows as a gallery, what `image-attachments`
 * fetches unasked, and what it makes a thumbnail of. Its list, compared by essence. `image/apng`
 * is not on it: an APNG so labelled is a file, and one labelled `image/png` its first frame.
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
  const type = contentTypeEssence(contentType)
  return type !== undefined && DISPLAYABLE_IMAGE.has(type)
}

export function isViewableImage(contentType: string | undefined): boolean {
  const type = contentTypeEssence(contentType)
  return type !== undefined && VIEWABLE_IMAGE.has(type)
}

export function isViewableVideo(contentType: string | undefined): boolean {
  const type = contentTypeEssence(contentType)
  return type !== undefined && VIEWABLE_VIDEO.has(type)
}

export function isViewableContentType(contentType: string | undefined): boolean {
  return isViewableImage(contentType) || isViewableVideo(contentType)
}

/** Only meaningful for a viewable type, which a caller checks first. */
export function mediaKindOf(contentType: string | undefined): MediaKind {
  return isViewableVideo(contentType) ? 'video' : 'image'
}

/**
 * How wide a message's attachments are drawn, in density-independent pixels: as wide as a bubble
 * is allowed to be. Here rather than with the screens because each app also asks libsession for
 * thumbnails this wide, times its display density, before anything is drawn.
 *
 * A number and not a constant shared with the bubble, because the bubble's own width is a
 * percentage of the pane and nothing measures it yet. When something does, the album takes it as
 * a prop - the album has never been the thing that decides how wide a message is.
 */
export const ALBUM_WIDTH = 240

/** How many attachments one message may carry. The legacy clients' limit; libsession sets none. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 32

/**
 * Leading bytes of each format the media scheme serves, as `[offset, bytes]` runs that must all
 * match.
 */
const SIGNATURES: readonly (readonly [contentType: string, runs: readonly [number, string][]])[] = [
  ['image/png', [[0, '\x89PNG\r\n\x1a\n']]],
  ['image/jpeg', [[0, '\xff\xd8\xff']]],
  ['image/gif', [[0, 'GIF87a']]],
  ['image/gif', [[0, 'GIF89a']]],
  [
    'image/webp',
    [
      [0, 'RIFF'],
      [8, 'WEBP'],
    ],
  ],
  ['image/bmp', [[0, 'BM']]],
  ['video/mp4', [[4, 'ftyp']]],
  ['video/webm', [[0, '\x1a\x45\xdf\xa3']]],
  ['video/ogg', [[0, 'OggS']]],
]

/** What the leading bytes say a file is, of the formats the media scheme serves, or null. */
export function sniffContentType(bytes: Uint8Array): string | null {
  const match = SIGNATURES.find(([, runs]) =>
    runs.every(([at, run]) => [...run].every((c, i) => bytes[at + i] === c.charCodeAt(0))),
  )
  return match?.[0] ?? null
}

/** Start-of-frame markers, which carry a JPEG's size; C4, C8 and CC share the range and are not. */
const START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

/** A JPEG's size from its frame header, or null when these bytes are not a JPEG that has one. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1] ?? 0
    const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)
    if (START_OF_FRAME.has(marker)) {
      const height = ((bytes[at + 5] ?? 0) << 8) | (bytes[at + 6] ?? 0)
      const width = ((bytes[at + 7] ?? 0) << 8) | (bytes[at + 8] ?? 0)
      return { width, height }
    }
    at += 2 + length
  }
  return null
}

/**
 * The edge to make thumbnails at for the densest of these displays. 1 with none connected, since
 * thumbnails are never remade and a headless start would otherwise ask for an edge of -Infinity.
 */
export function thumbnailEdgePxFor(scaleFactors: readonly number[]): number {
  return Math.round(ALBUM_WIDTH * Math.max(1, ...scaleFactors))
}
