import { isDisplayableImage } from '@session/basic-types'
import type { Attachment, Message } from '@session/client'
import { describe, expect, it } from 'vitest'

import { attachmentView, canChooseView } from '#src/attachmentView'

function attachment(index: number, contentType?: string): Attachment {
  return {
    index,
    ...(contentType === undefined ? {} : { contentType }),
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
  }
}

/**
 * libsession's rules by default: viewable when it has attachments and every one is a displayable
 * image type, and stored as a gallery wherever it is viewable.
 */
function message(
  attachments: Attachment[],
  galleryViewable = attachments.length > 0 &&
    attachments.every((a) => isDisplayableImage(a.contentType)),
  gallery = galleryViewable,
): Message {
  return { attachments, galleryViewable, gallery } as unknown as Message
}

describe('which shape a message takes', () => {
  it('draws pictures as a gallery', () => {
    expect(attachmentView(message([attachment(0, 'image/jpeg')]))).toBe('gallery')
  })

  it('sends pictures beside a video to the list', () => {
    // A video is a file until libsession exposes a still to draw for it.
    const set = message([attachment(0, 'image/jpeg'), attachment(1, 'video/mp4')])
    expect(attachmentView(set)).toBe('list')
  })

  it('sends the whole set to the list when one attachment is a plain file', () => {
    // Pictures included. A gallery with the documents hanging off the bottom draws one message as
    // two objects and leaves the reader to work out that they are one.
    const set = message([
      attachment(0, 'image/jpeg'),
      attachment(1, 'image/png'),
      attachment(2, 'application/pdf'),
    ])
    expect(attachmentView(set)).toBe('list')
  })

  it('sends a set the sender typed nothing for to the list', () => {
    // An absent content type claims nothing, and a tile drawn from nothing is a broken picture.
    expect(attachmentView(message([attachment(0)]))).toBe('list')
  })

  it('draws a list wherever libsession says the set cannot be a gallery', () => {
    const set = message([attachment(0, 'image/jpeg'), attachment(1, 'image/png')], false)
    expect(attachmentView(set)).toBe('list')
  })

  it('draws a list for a picture the viewer here cannot open, whatever libsession says', () => {
    // libsession's whitelist takes AVIF.
    const set = message([attachment(0, 'image/jpeg'), attachment(1, 'image/avif')], true)
    expect(attachmentView(set)).toBe('list')
  })
})

describe('when the reader gets to choose', () => {
  const photos = message([attachment(0, 'image/jpeg'), attachment(1, 'image/png')])
  const mixed = message([attachment(0, 'image/jpeg'), attachment(1, 'application/pdf')])

  it('offers the choice on a set a gallery could hold', () => {
    expect(canChooseView(photos)).toBe(true)
  })

  it('offers none where a plain file has settled it', () => {
    // A plain file makes the gallery impossible, not unwanted - so there is nothing to choose
    // between, and a toggle with one working half is worse than no toggle.
    expect(canChooseView(mixed)).toBe(false)
  })

  it('draws the list once libsession stores that the reader asked for it', () => {
    const listed = message([attachment(0, 'image/jpeg'), attachment(1, 'image/png')], true, false)
    expect(attachmentView(listed)).toBe('list')
  })

  it('draws the gallery libsession starts a viewable set as', () => {
    expect(attachmentView(photos)).toBe('gallery')
  })
})
