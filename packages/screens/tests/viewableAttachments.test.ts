import { memoryPorts, resetPorts, setPorts } from '@session/app'
import type { Attachment, Message } from '@session/client'
import { afterEach, describe, expect, it } from 'vitest'

import {
  isViewable,
  leadsWithPicture,
  viewableAttachments,
  viewerUri,
} from '#src/viewableAttachments'

function attachment(index: number, contentType?: string): Attachment {
  return {
    index,
    ...(contentType === undefined ? {} : { contentType }),
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    uploaded: true,
    availability: 'absent',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
  }
}

function message(attachments: Attachment[]): Message {
  return { attachments } as unknown as Message
}

describe('which attachments a viewer can show', () => {
  it('takes pictures', () => {
    expect(isViewable(attachment(0, 'image/jpeg'))).toBe(true)
    expect(isViewable(attachment(0, 'image/png'))).toBe(true)
  })

  it('takes the unregistered image/jpg senders send, and a type with parameters', () => {
    expect(isViewable(attachment(0, 'image/jpg'))).toBe(true)
    expect(isViewable(attachment(0, 'Image/JPEG; charset=binary'))).toBe(true)
  })

  it('leaves out pictures no renderer here draws reliably', () => {
    // SVG is a script-capable document, not a bitmap.
    expect(isViewable(attachment(0, 'image/svg+xml'))).toBe(false)
    expect(isViewable(attachment(0, 'image/heic'))).toBe(false)
    expect(isViewable(attachment(0, 'image/tiff'))).toBe(false)
  })

  it('leaves everything else alone', () => {
    expect(isViewable(attachment(0, 'application/pdf'))).toBe(false)
    expect(isViewable(attachment(0, 'audio/mpeg'))).toBe(false)
    // A file until libsession exposes a still to draw for it.
    expect(isViewable(attachment(0, 'video/mp4'))).toBe(false)
    // The sender's claim is all there is, and an absent one claims nothing.
    expect(isViewable(attachment(0))).toBe(false)
  })

  it('takes the picture from a set gallery_viewable would refuse', () => {
    // A picture beside a document is a list, and its picture is still something to open.
    const set = message([attachment(0, 'image/jpeg'), attachment(1, 'application/pdf')])
    expect(viewableAttachments(set).map((a) => a.index)).toEqual([0])
  })

  it('leaves a position in the viewer different from a position in the message', () => {
    // The case that saves the wrong file if the two are confused: a document between two pictures
    // means the second picture is index 2 on the message and 1 in the viewer.
    const set = message([
      attachment(0, 'image/jpeg'),
      attachment(1, 'application/pdf'),
      attachment(2, 'image/png'),
    ])
    const viewable = viewableAttachments(set)
    expect(viewable.map((a) => a.index)).toEqual([0, 2])
    expect(viewable[1]?.index).toBe(2)
  })
})

describe('which file rows lead with a picture', () => {
  it('leads with the thumbnail of a type the viewer cannot open', () => {
    const avif = { ...attachment(0, 'image/avif'), hasThumbnail: true }
    expect(isViewable(avif)).toBe(false)
    expect(leadsWithPicture(avif)).toBe(true)
    expect(leadsWithPicture({ ...attachment(0, 'image/pjpeg'), hasThumbnail: true })).toBe(true)
  })

  it('leads with a viewable picture before its thumbnail exists, for the placeholder', () => {
    expect(leadsWithPicture(attachment(0, 'image/jpeg'))).toBe(true)
  })

  it('leads with the glyph where there is no thumbnail and nothing to view', () => {
    expect(leadsWithPicture(attachment(0, 'image/avif'))).toBe(false)
    expect(leadsWithPicture(attachment(0, 'application/pdf'))).toBe(false)
  })
})

describe('what the viewer is handed', () => {
  afterEach(() => {
    resetPorts()
  })

  function serving(): void {
    setPorts(
      memoryPorts({
        media: {
          urlFor: ({ messageId, index }) => `media://${String(messageId)}/${String(index)}`,
          thumbhashUrlFor: () => null,
          thumbnailUrlFor: () => null,
        },
      }),
    )
  }

  it('hands a picture its url', () => {
    serving()
    expect(viewerUri(7, attachment(2, 'image/png'))).toBe('media://7/2')
  })
})
