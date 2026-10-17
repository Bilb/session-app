import { memoryPorts, resetPorts, setPorts } from '@session/app'
import type { Attachment, Message } from '@session/client'
import type { MediaViewerItem } from '@session/ui'
import { afterEach, describe, expect, it } from 'vitest'

import {
  heldItem,
  isViewable,
  leadUri,
  leadsWithPicture,
  opensInViewer,
  viewerFit,
  viewableAttachments,
  viewerItem,
} from '#src/viewableAttachments'

function attachment(index: number, contentType?: string): Attachment {
  return {
    index,
    ...(contentType === undefined ? {} : { contentType }),
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    hasRendition: false,
    originalFile: false,
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

describe('a picture sent as the original file', () => {
  const original = { ...attachment(1, 'image/jpeg'), originalFile: true }

  it('is a picture, but one the viewer never opens', () => {
    expect(isViewable(original)).toBe(true)
    expect(opensInViewer(original)).toBe(false)
    expect(opensInViewer(attachment(0, 'image/jpeg'))).toBe(true)
  })

  it('stays closed to a rendition of an original, which libsession does not make anyway', () => {
    expect(opensInViewer({ ...original, hasRendition: true })).toBe(false)
  })

  it('is left out of the viewer, so paging cannot reach it', () => {
    const set = message([attachment(0, 'image/jpeg'), original, attachment(2, 'image/png')])
    expect(viewableAttachments(set).map((a) => a.index)).toEqual([0, 2])
  })

  it('still leads its row with a picture, for its thumbnail', () => {
    expect(leadsWithPicture({ ...original, hasThumbnail: true })).toBe(true)
  })
})

describe('a picture of a type nothing here draws', () => {
  it('opens in the viewer once libsession has a rendition of it', () => {
    const avif = attachment(0, 'image/avif')
    expect(opensInViewer(avif)).toBe(false)
    expect(opensInViewer({ ...avif, hasRendition: true })).toBe(true)
    expect(viewableAttachments(message([{ ...avif, hasRendition: true }]))).toHaveLength(1)
  })

  it('awaits the rendition libsession makes of it, rather than exporting until then', () => {
    expect(viewerFit(attachment(0, 'image/avif'))).toBe('awaitsRendition')
    expect(viewerFit({ ...attachment(0, 'image/avif'), hasRendition: true })).toBe('opens')
    expect(viewerFit({ ...attachment(0, 'image/avif'), originalFile: true })).toBe('exports')
  })

  it('exports a picture libsession makes no rendition of', () => {
    expect(viewerFit(attachment(0, 'image/heic'))).toBe('exports')
    expect(viewerFit(attachment(0, 'image/tiff'))).toBe('exports')
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
          renditionUrlFor: ({ messageId, index }) =>
            `rendition://${String(messageId)}/${String(index)}`,
        },
      }),
    )
  }

  it('hands a picture its url until libsession has made a rendition of it', () => {
    serving()
    expect(viewerItem(7, attachment(2, 'image/png'))).toEqual({ uri: 'media://7/2' })
  })

  it('hands a picture its rendition once there is one', () => {
    serving()
    expect(viewerItem(7, { ...attachment(2, 'image/png'), hasRendition: true })).toEqual({
      uri: 'rendition://7/2',
      fallbackUri: 'media://7/2',
    })
  })

  it('has no file to fall back on for a rendition of a type nothing here draws', () => {
    serving()
    expect(viewerItem(7, { ...attachment(2, 'image/avif'), hasRendition: true })).toEqual({
      uri: 'rendition://7/2',
      fallbackUri: undefined,
    })
  })
})

describe('an item an open viewer holds', () => {
  it('stays the one first handed over, whatever is made of the attachment since', () => {
    const held = new Map<string, MediaViewerItem>()
    const file = { uri: 'media://7/0' }
    expect(heldItem(held, '7:0', () => file)).toBe(file)
    expect(heldItem(held, '7:0', () => ({ uri: 'rendition://7/0' }))).toBe(file)
    expect(heldItem(held, '7:1', () => ({ uri: 'media://7/1' }))).toEqual({ uri: 'media://7/1' })
  })
})

describe('what a row square or an album tile draws', () => {
  afterEach(() => {
    resetPorts()
  })

  function serving(): void {
    setPorts(
      memoryPorts({
        media: {
          urlFor: ({ messageId, index }) => `media://${String(messageId)}/${String(index)}`,
          thumbhashUrlFor: () => null,
          thumbnailUrlFor: ({ messageId, index }) =>
            `thumb://${String(messageId)}/${String(index)}`,
          renditionUrlFor: () => null,
        },
      }),
    )
  }

  it("draws libsession's thumbnail where there is one", () => {
    serving()
    const jpeg = { ...attachment(1, 'image/jpeg'), hasThumbnail: true }
    expect(leadUri(7, jpeg, 'ready')).toBe('thumb://7/1')
    expect(leadUri(7, jpeg, 'idle')).toBe('thumb://7/1')
  })

  it('draws a downloaded BMP, which libsession makes no thumbnail of, from the file', () => {
    serving()
    const bmp = { ...attachment(0, 'image/bmp'), availability: 'cached' as const }
    expect(leadsWithPicture(bmp)).toBe(true)
    expect(leadUri(7, bmp, 'ready')).toBe('media://7/0')
  })

  it('keeps a downloaded JPEG on its placeholder until libsession thumbnails it', () => {
    serving()
    const jpeg = { ...attachment(2, 'image/jpeg'), availability: 'cached' as const }
    expect(leadsWithPicture(jpeg)).toBe(true)
    expect(leadUri(7, jpeg, 'ready')).toBeUndefined()
    expect(leadUri(7, { ...jpeg, hasThumbnail: true }, 'ready')).toBe('thumb://7/2')
  })

  it('keeps the placeholder until the file is here', () => {
    serving()
    for (const state of ['idle', 'fetching', 'failed', 'unavailable'] as const)
      expect(leadUri(7, attachment(0, 'image/bmp'), state), state).toBeUndefined()
  })

  it('never draws a file the viewer cannot open', () => {
    serving()
    expect(leadUri(7, attachment(0, 'image/avif'), 'ready')).toBeUndefined()
    expect(leadUri(7, attachment(0, 'application/pdf'), 'ready')).toBeUndefined()
  })
})
