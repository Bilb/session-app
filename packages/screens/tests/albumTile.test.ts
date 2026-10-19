import { describe, expect, it } from 'vitest'

import { albumTileName } from '#src/albumTileName'
import { PENDING_COPY } from '#src/pendingCopy'

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
