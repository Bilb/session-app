import { readFileSync } from 'node:fs'
import { PENDING_COPY } from '@session/localization'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { albumTileName } from '#src/albumTileName'

describe('what a screen reader calls a picture in an album', () => {
  it('is its filename where it has one', () => {
    expect(albumTileName('harbour.jpg', 0, 2)).toBe('harbour.jpg')
  })

  it('is its place among the album’s pictures otherwise, counted from 1', () => {
    expect(albumTileName(undefined, 0, 7)).toBe('Image 1 of 7')
    expect(albumTileName(undefined, 6, 7)).toBe(PENDING_COPY.attachmentImagePosition(7, 7))
  })
})

describe('the name of the tile under "+N"', () => {
  it('is its own and the overflow’s, in one string a locale can reorder', () => {
    expect(PENDING_COPY.attachmentNameAndMore('harbour.jpg', 3)).toBe('harbour.jpg, and 3 more')
  })
})

/** Read from the source: whether a memoised tile re-renders is not something a render shows. */
describe('an album', () => {
  const album = readFileSync(join(import.meta.dirname, '../src/MessageAlbum.tsx'), 'utf8')

  it('holds a tile still while a transfer reports, the open callback included', () => {
    // A new callback per report would re-render every memoised tile with it.
    expect(album).toContain('onOpen={openAt}')
    expect(album).toMatch(/const openAt = useCallback\([\s\S]*?\[viewable\],\s*\)/)
  })
})
