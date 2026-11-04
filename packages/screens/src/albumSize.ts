import { ALBUM_SIZES, type AlbumSize, type AlbumSurface } from '@session/basic-types'
import { MESSAGE_FRAME_INSET_PX, SPACE_SCALE } from '@session/ui'
import { createContext } from 'react'

/**
 * How wide the transcript a message is drawn in is, or null before it is measured. Context rather
 * than the store: two panes can show two transcripts of different widths at once.
 */
export const TranscriptWidthContext = createContext<number | null>(null)

/** What a message's album is drawn at: its width, and how tall a picture alone may be. */
export interface AlbumGeometry {
  widthPx: number
  loneMaxHeightPx: number | undefined
}

/**
 * An album's width in a transcript `transcriptWidthPx` wide: its share, within its px range, and
 * never wider than a bubble can be there, so a narrow pane shrinks the album rather than
 * overflowing. Its narrowest before the transcript is measured.
 */
export function albumWidthPx(
  size: Pick<AlbumSize, 'widthShare' | 'minWidthPx' | 'maxWidthPx'>,
  transcriptWidthPx: number | null,
): number {
  if (transcriptWidthPx === null) return size.minWidthPx
  const fits = transcriptWidthPx - 2 * SPACE_SCALE.md - 2 * MESSAGE_FRAME_INSET_PX
  const shared = Math.max(transcriptWidthPx * size.widthShare, size.minWidthPx)
  const widest = Math.max(size.minWidthPx, size.maxWidthPx)
  return Math.max(1, Math.round(Math.min(shared, widest, fits)))
}

/** The album on `surface` in a transcript `transcriptWidthPx` wide. */
export function albumGeometry(
  surface: AlbumSurface,
  transcriptWidthPx: number | null,
): AlbumGeometry {
  const size = ALBUM_SIZES[surface]
  return {
    widthPx: albumWidthPx(size, transcriptWidthPx),
    loneMaxHeightPx: size.loneMaxHeightPx,
  }
}
