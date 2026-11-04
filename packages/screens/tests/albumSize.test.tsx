import { ALBUM_SIZES } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import { albumGeometry, albumWidthPx } from '#src/albumSize'

describe('the width an album is drawn at', () => {
  it('is three quarters of a narrow-layout transcript, within 240 to 320', () => {
    expect(albumGeometry('narrow', 390).widthPx).toBe(293)
    expect(albumGeometry('narrow', 430).widthPx).toBe(320)
    expect(albumGeometry('narrow', 320).widthPx).toBe(240)
  })

  it('is three fifths of a wide-layout transcript, within 320 to 480', () => {
    expect(albumGeometry('wide', 700).widthPx).toBe(420)
    expect(albumGeometry('wide', 1200).widthPx).toBe(480)
    expect(albumGeometry('wide', 500).widthPx).toBe(320)
  })

  it('is its narrowest before the transcript is measured', () => {
    expect(albumGeometry('narrow', null).widthPx).toBe(ALBUM_SIZES.narrow.minWidthPx)
    expect(albumGeometry('wide', null).widthPx).toBe(ALBUM_SIZES.wide.minWidthPx)
  })

  it('never runs past the row it is in, however narrow', () => {
    // 300 less 16 px padding and the bubble's 16 px insets each side.
    expect(albumWidthPx(ALBUM_SIZES.wide, 300)).toBe(236)
  })

  it('caps a lone picture at 460 px in the wide layout, and not in the narrow one', () => {
    expect(albumGeometry('wide', 1200).loneMaxHeightPx).toBe(460)
    expect(albumGeometry('narrow', 430).loneMaxHeightPx).toBeUndefined()
  })
})
