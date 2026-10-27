import { describe, expect, it } from 'vitest'

import {
  ALBUM_WIDTH,
  contentTypeEssence,
  isDisplayableImage,
  isViewableContentType,
  isViewableImage,
  isViewableVideo,
  jpegSize,
  mediaKindOf,
  thumbnailEdgePxFor,
} from '#src/media'

describe('the essence of a declared content type', () => {
  it('drops parameters, folds case and trims ASCII space', () => {
    expect(contentTypeEssence('Image/JPEG; charset=binary')).toBe('image/jpeg')
    expect(contentTypeEssence(' video/MP4 ;codecs="avc1"')).toBe('video/mp4')
    expect(contentTypeEssence('\t\r\n image/png \n\r\t')).toBe('image/png')
    expect(contentTypeEssence('image/png')).toBe('image/png')
  })

  it('keeps a NUL, which no type it is compared with carries', () => {
    expect(contentTypeEssence('image/png\0.exe')).toBe('image/png\0.exe')
    expect(isViewableImage('image/png\0')).toBe(false)
    expect(isDisplayableImage('image/png\0')).toBe(false)
  })

  it('trims space, tab, CR and LF alone', () => {
    expect(contentTypeEssence('\fimage/png\v')).toBe('\fimage/png\v')
    expect(contentTypeEssence('\u00a0image/png')).toBe('\u00a0image/png')
  })

  it('folds ASCII case alone', () => {
    // A Unicode-aware lowercase turns the Kelvin sign into a k.
    expect(contentTypeEssence('image/\u212a')).toBe('image/\u212a')
  })

  it('has no essence for an absent type', () => {
    expect(contentTypeEssence(undefined)).toBeUndefined()
  })
})

describe('which content types are viewable', () => {
  it('draws the common bitmaps and refuses svg', () => {
    expect(isViewableImage('image/png')).toBe(true)
    expect(isViewableImage('image/svg+xml')).toBe(false)
  })

  it('accepts the unregistered image/jpg that senders send', () => {
    expect(isViewableImage('image/jpg')).toBe(true)
  })

  it('ignores parameters and case', () => {
    expect(isViewableImage('Image/JPEG; charset=binary')).toBe(true)
    expect(isViewableVideo('VIDEO/MP4;codecs="avc1"')).toBe(true)
    expect(isViewableImage('\t\r\n image/png \n\r\t')).toBe(true)
  })

  it('trims no Unicode space', () => {
    expect(isViewableImage('\u00a0image/png')).toBe(false)
    expect(isViewableImage('\ufeffimage/png')).toBe(false)
    expect(isViewableImage('image/png\u2003')).toBe(false)
  })

  it('refuses an absent or unknown type', () => {
    expect(isViewableContentType(undefined)).toBe(false)
    expect(isViewableContentType('application/octet-stream')).toBe(false)
    expect(isViewableContentType('video/quicktime')).toBe(false)
  })
})

describe('which content types libsession calls displayable', () => {
  it('is its whitelist, in any ASCII case', () => {
    expect(isDisplayableImage('IMAGE/Jpeg')).toBe(true)
    expect(isDisplayableImage('image/pjpeg')).toBe(true)
    expect(isDisplayableImage('image/avif')).toBe(true)
  })

  it('refuses a picture outside it, and a prefix match', () => {
    expect(isDisplayableImage('image/svg+xml')).toBe(false)
    expect(isDisplayableImage('image/heic')).toBe(false)
    expect(isDisplayableImage('image/bmp')).toBe(false)
    expect(isDisplayableImage('image/pngx')).toBe(false)
    expect(isDisplayableImage(undefined)).toBe(false)
  })

  it('compares the essence, as libsession does', () => {
    expect(isDisplayableImage('image/jpeg; charset=binary')).toBe(true)
    expect(isDisplayableImage(' image/png ')).toBe(true)
    expect(isDisplayableImage('\fimage/png')).toBe(false)
  })

  it('shows an APNG as a file', () => {
    expect(isDisplayableImage('image/apng')).toBe(false)
    expect(isViewableImage('image/apng')).toBe(false)
  })
})

describe('a viewable type’s kind', () => {
  it('is video only for a viewable video', () => {
    expect(mediaKindOf('video/webm')).toBe('video')
    expect(mediaKindOf('image/gif')).toBe('image')
  })
})

describe('the edge thumbnails are made at', () => {
  it('follows the densest display', () => {
    expect(thumbnailEdgePxFor([1, 2, 1.5])).toBe(ALBUM_WIDTH * 2)
  })

  it('makes them at 1x with no display connected', () => {
    expect(thumbnailEdgePxFor([])).toBe(ALBUM_WIDTH)
  })
})

/** A JPEG's markers up to a frame header under `marker`, which is all a size is read from. */
function jpegHeader(width: number, height: number, marker = 0xc0): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    marker,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ])
}

describe("a JPEG's size", () => {
  it('reads a baseline or progressive frame header', () => {
    expect(jpegSize(jpegHeader(4032, 3024))).toEqual({ width: 4032, height: 3024 })
    expect(jpegSize(jpegHeader(720, 1280, 0xc2))).toEqual({ width: 720, height: 1280 })
  })

  it('walks past the segments before the frame header', () => {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]
    const dht = [0xff, 0xc4, 0x00, 0x03, 0x00]
    const frame = jpegHeader(300, 200).subarray(2)
    const bytes = Uint8Array.from([0xff, 0xd8, ...app0, ...dht, ...frame])
    expect(jpegSize(bytes)).toEqual({ width: 300, height: 200 })
  })

  it('answers null for what is not a JPEG with a frame header', () => {
    expect(jpegSize(new Uint8Array(64))).toBeNull()
    expect(jpegSize(Uint8Array.from('GIF89a', (c) => c.charCodeAt(0)))).toBeNull()
    // C4, a Huffman table, shares the frame markers' range.
    expect(jpegSize(jpegHeader(300, 200, 0xc4))).toBeNull()
    expect(jpegSize(jpegHeader(300, 200).subarray(0, 8))).toBeNull()
  })
})
