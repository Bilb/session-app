import { ALBUM_SIZES } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import { albumGeometry, albumWidthPx } from '#src/albumSize'

describe('the width an album is drawn at', () => {
  it('is three quarters of a narrow-layout transcript, within 240 to 280', () => {
    expect(albumGeometry('narrow', 340).widthPx).toBe(255)
    expect(albumGeometry('narrow', 390).widthPx).toBe(280)
    expect(albumGeometry('narrow', 320).widthPx).toBe(240)
  })

  it('is three fifths of a wide-layout transcript, within 280 to 360', () => {
    expect(albumGeometry('wide', 520).widthPx).toBe(312)
    expect(albumGeometry('wide', 1200).widthPx).toBe(360)
    expect(albumGeometry('wide', 420).widthPx).toBe(280)
  })

  it('is its narrowest before the transcript is measured', () => {
    expect(albumGeometry('narrow', null).widthPx).toBe(ALBUM_SIZES.narrow.minWidthPx)
    expect(albumGeometry('wide', null).widthPx).toBe(ALBUM_SIZES.wide.minWidthPx)
  })

  it('never runs past the row it is in, however narrow', () => {
    // 300 less 16 px padding and the bubble's 16 px insets each side.
    expect(albumWidthPx(ALBUM_SIZES.wide, 300)).toBe(236)
  })

  it('caps a lone picture at 340 px in either layout', () => {
    expect(albumGeometry('wide', 1200).loneMaxHeightPx).toBe(340)
    expect(albumGeometry('narrow', 430).loneMaxHeightPx).toBe(340)
  })
})
