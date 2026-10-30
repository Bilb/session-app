import { ALBUM_SIZES } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import { albumGeometry, albumWidthPx } from '#src/albumSize'

describe('the width an album is drawn at', () => {
  it('is three quarters of a phone’s transcript, within 240 to 320', () => {
    expect(albumGeometry('mobile', 390).widthPx).toBe(293)
    expect(albumGeometry('mobile', 430).widthPx).toBe(320)
    expect(albumGeometry('mobile', 320).widthPx).toBe(240)
  })

  it('is three fifths of a desktop transcript, within 320 to 480', () => {
    expect(albumGeometry('desktop', 700).widthPx).toBe(420)
    expect(albumGeometry('desktop', 1200).widthPx).toBe(480)
    expect(albumGeometry('desktop', 500).widthPx).toBe(320)
  })

  it('is its narrowest before the transcript is measured', () => {
    expect(albumGeometry('mobile', null).widthPx).toBe(ALBUM_SIZES.mobile.minWidthPx)
    expect(albumGeometry('desktop', null).widthPx).toBe(ALBUM_SIZES.desktop.minWidthPx)
  })

  it('never runs past the row it is in, however narrow', () => {
    // 300 less 16 px padding and the bubble's 16 px insets each side.
    expect(albumWidthPx(ALBUM_SIZES.desktop, 300)).toBe(236)
  })

  it('caps a lone picture at 460 px on the desktop, and not on the phone', () => {
    expect(albumGeometry('desktop', 1200).loneMaxHeightPx).toBe(460)
    expect(albumGeometry('mobile', 430).loneMaxHeightPx).toBeUndefined()
  })
})
