import type { Attachment } from '@session/client'
import { describe, expect, it } from 'vitest'

import { albumAspect } from '#src/albumAspect'

function attachment(over: Partial<Attachment> = {}): Attachment {
  return {
    index: 0,
    contentType: 'image/jpeg',
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    thumbnailWidthPx: 0,
    thumbnailHeightPx: 0,
    hasRendition: false,
    renditionRefused: false,
    originalFile: false,
    uploaded: true,
    availability: 'absent',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
    ...over,
  }
}

/** A thumbnail libsession made of a picture this shape, 720 px tall and cropped past 21:9. */
function thumbnailOf(width: number, height: number): Partial<Attachment> {
  const aspect = Math.min(21 / 9, Math.max(9 / 21, width / height))
  return { hasThumbnail: true, thumbnailWidthPx: Math.round(720 * aspect), thumbnailHeightPx: 720 }
}

describe('the shape an album tile is laid out at', () => {
  it('is the sender’s before anything has downloaded', () => {
    expect(albumAspect(attachment({ width: 4032, height: 3024 }))).toBe(4 / 3)
  })

  it('stays the sender’s once the thumbnail agrees, so the tile does not move', () => {
    const sent = { width: 1179, height: 2556 }
    expect(albumAspect(attachment({ ...sent, ...thumbnailOf(1179, 2556) }))).toBe(1179 / 2556)
  })

  it('stays the sender’s for a panorama its thumbnail was cropped from', () => {
    expect(albumAspect(attachment({ width: 6000, height: 1000, ...thumbnailOf(6000, 1000) }))).toBe(
      6,
    )
  })

  it('is the thumbnail’s where the sender’s is sideways', () => {
    const upright = thumbnailOf(3024, 4032)
    expect(albumAspect(attachment({ width: 4032, height: 3024, ...upright }))).toBeCloseTo(3 / 4, 2)
  })

  it('is the thumbnail’s where the sender gave no dimensions', () => {
    expect(albumAspect(attachment(thumbnailOf(1600, 900)))).toBeCloseTo(16 / 9, 2)
  })

  it('is the hash’s rough shape where there is no size at all', () => {
    expect(albumAspect(attachment({ hasThumbhash: true, thumbhashAspect: 7 / 5 }))).toBe(7 / 5)
  })

  it('takes the sender’s size and the thumbnail’s over the hash’s', () => {
    const hash = { hasThumbhash: true, thumbhashAspect: 7 / 5 }
    expect(albumAspect(attachment({ ...hash, width: 1600, height: 900 }))).toBe(16 / 9)
    expect(albumAspect(attachment({ ...hash, ...thumbnailOf(1600, 900) }))).toBeCloseTo(16 / 9, 2)
  })

  it('is unknown, which draws a square, with neither', () => {
    expect(albumAspect(attachment())).toBeUndefined()
    expect(albumAspect(attachment({ width: 0, height: 300 }))).toBeUndefined()
    expect(albumAspect(attachment({ width: 300 }))).toBeUndefined()
  })

  it('ignores a thumbnail size reported without a thumbnail', () => {
    const stale = { thumbnailWidthPx: 720, thumbnailHeightPx: 720 }
    expect(albumAspect(attachment({ width: 1600, height: 900, ...stale }))).toBe(16 / 9)
  })
})
