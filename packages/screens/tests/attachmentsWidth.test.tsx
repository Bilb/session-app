import { ALBUM_WIDTH } from '@session/basic-types'
import type { Attachment, Message } from '@session/client'
import { describe, expect, it } from 'vitest'

import { FOOTER_MIN_WIDTH_PX } from '#src/AttachmentFooter'
import { albumGeometry, type AlbumGeometry } from '#src/albumSize'
import { attachmentsWidthPx } from '#src/attachmentsWidth'

function picture(
  index: number,
  width: number,
  height: number,
  contentType = 'image/jpeg',
): Attachment {
  return {
    index,
    contentType,
    width,
    height,
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    thumbnailWidthPx: 0,
    thumbnailHeightPx: 0,
    hasRendition: false,
    renditionRefused: false,
    originalFile: false,
    uploaded: true,
    availability: 'cached',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
  }
}

function message(attachments: Attachment[], gallery = true): Message {
  return { attachments, gallery, galleryViewable: true } as unknown as Message
}

const IPHONE = picture(0, 1179, 2556)

/** The phone's narrowest album, with a lone picture capped at 320 px. */
const NARROWING: AlbumGeometry = { ...albumGeometry('mobile', null), loneMaxHeightPx: 320 }

describe('the width a message’s attachments are drawn at', () => {
  it('is the album’s for a lone picture the shipped layout draws full width', () => {
    expect(
      attachmentsWidthPx(message([picture(0, 1600, 1200)]), albumGeometry('mobile', null)),
    ).toBe(ALBUM_WIDTH)
  })

  it('is a narrowed lone picture’s own width, so the bubble shrinks to it', () => {
    expect(attachmentsWidthPx(message([IPHONE]), NARROWING)).toBe(Math.round((320 * 1179) / 2556))
  })

  it('is never narrower than the footer can be drawn', () => {
    // A 9:21 picture under a 120 px cap is 51 px wide, narrower than the footer can be.
    const ultratall = picture(0, 900, 2100)
    const capped = { ...NARROWING, loneMaxHeightPx: 120 }
    expect(attachmentsWidthPx(message([ultratall]), capped)).toBe(FOOTER_MIN_WIDTH_PX)
  })

  it('is the album’s for several pictures, and for a list whatever it holds', () => {
    expect(attachmentsWidthPx(message([IPHONE, picture(1, 1179, 2556)]), NARROWING)).toBe(
      ALBUM_WIDTH,
    )
    expect(attachmentsWidthPx(message([IPHONE], false), NARROWING)).toBe(ALBUM_WIDTH)
  })
})
