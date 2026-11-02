import { useMedia } from '@session/ui'
import { useContext, useMemo } from 'react'

import { albumGeometry, TranscriptWidthContext, type AlbumGeometry } from './albumSize'

/**
 * What a message's album is drawn at, in the layout the window is in and the transcript it is in.
 * `gtSm` is the breakpoint the shell puts the list and the conversation side by side at.
 */
export function useAlbumGeometry(): AlbumGeometry {
  const transcriptWidthPx = useContext(TranscriptWidthContext)
  const surface = useMedia().gtSm ? 'wide' : 'narrow'
  return useMemo(() => albumGeometry(surface, transcriptWidthPx), [surface, transcriptWidthPx])
}
