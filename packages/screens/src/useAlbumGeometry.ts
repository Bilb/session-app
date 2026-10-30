import { DRAWN_ON_DESKTOP } from '@session/ui'
import { useContext, useMemo } from 'react'

import { albumGeometry, TranscriptWidthContext, type AlbumGeometry } from './albumSize'

/** What a message's album is drawn at, on this device and in the transcript it is in. */
export function useAlbumGeometry(): AlbumGeometry {
  const transcriptWidthPx = useContext(TranscriptWidthContext)
  const surface = DRAWN_ON_DESKTOP ? 'desktop' : 'mobile'
  return useMemo(() => albumGeometry(surface, transcriptWidthPx), [surface, transcriptWidthPx])
}
