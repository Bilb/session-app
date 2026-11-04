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
 * The narrowest a message's attachments are drawn, in density-independent pixels: the narrow
 * layout's album before the transcript is measured, and on the narrowest phones. `ALBUM_SIZES`
 * says how wide they are drawn once it is.
 */
export const ALBUM_WIDTH = 240

/**
 * The two layouts the album is sized for, by the window's width rather than the platform: `narrow`
 * is the single-pane layout (a phone, or a desktop window narrowed past the two-pane breakpoint);
 * `wide` is the list and the conversation side by side (any desktop window past it, a tablet).
 */
export type AlbumSurface = 'narrow' | 'wide'

export interface AlbumSize {
  /** The album's width as a share of the transcript it is drawn in. */
  widthShare: number
  minWidthPx: number
  maxWidthPx: number
  /** The tallest a picture sent on its own is drawn, where its shape alone would draw it taller. */
  loneMaxHeightPx?: number | undefined
}

/**
 * How wide an album is drawn on each, and how tall a picture alone: a share of the transcript,
 * within a px range. Here rather than with the screens because each app also sizes libsession's
 * thumbnails from them, times its display density, before anything is drawn.
 */
export const ALBUM_SIZES: Readonly<Record<AlbumSurface, AlbumSize>> = {
  narrow: { widthShare: 0.75, minWidthPx: ALBUM_WIDTH, maxWidthPx: 320 },
  wide: { widthShare: 0.6, minWidthPx: 320, maxWidthPx: 480, loneMaxHeightPx: 460 },
}

/**
 * The tallest shape, width over height, a picture sent on its own is drawn at as wide as the album:
 * a phone camera's portrait. A taller one is drawn that tall and narrower, so a screenshot cannot
 * take a screen of transcript.
 * Here rather than with the album's layout because thumbnails are made for the tile it gives.
 */
export const ALBUM_LONE_MIN_ASPECT = 3 / 4

/**
 * The tallest any tile is drawn on a surface: a row is never taller than the album is wide, and a
 * picture alone never taller than a 3:4 portrait as wide as the album, or than its cap.
 */
export function tallestTilePx(surface: AlbumSurface): number {
  const { maxWidthPx, loneMaxHeightPx = Number.POSITIVE_INFINITY } = ALBUM_SIZES[surface]
  return Math.round(
    Math.max(maxWidthPx, Math.min(maxWidthPx / ALBUM_LONE_MIN_ASPECT, loneMaxHeightPx)),
  )
}

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

/** libsession's most for a thumbnail's edge; it clamps a larger one to this. */
const MAX_THUMBNAIL_EDGE_PX = 1024

/**
 * The edge to make thumbnails at for the densest of these displays. 1 with none connected, since
 * thumbnails are never remade and a headless start would otherwise ask for an edge of -Infinity.
 *
 * libsession's edge is a thumbnail's height, so it is the surface's tallest tile's, within
 * libsession's own most.
 */
export function thumbnailEdgePxFor(scaleFactors: readonly number[], surface: AlbumSurface): number {
  return Math.min(
    MAX_THUMBNAIL_EDGE_PX,
    Math.round(tallestTilePx(surface) * Math.max(1, ...scaleFactors)),
  )
}
