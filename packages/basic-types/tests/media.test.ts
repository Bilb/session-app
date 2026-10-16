import { describe, expect, it } from 'vitest'

import {
  contentTypeEssence,
  isDisplayableImage,
  isViewableContentType,
  isViewableImage,
  isViewableVideo,
  mediaKindOf,
} from '#src/media'

describe('the essence of a declared content type', () => {
  it('drops parameters, folds case and trims ASCII space', () => {
    expect(contentTypeEssence('Image/JPEG; charset=binary')).toBe('image/jpeg')
    expect(contentTypeEssence(' video/MP4 ;codecs="avc1"')).toBe('video/mp4')
    expect(contentTypeEssence('image/png')).toBe('image/png')
  })

  it('leaves Unicode space alone, as the shim does', () => {
    expect(contentTypeEssence('\u00a0image/png')).toBe('\u00a0image/png')
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
    expect(isViewableImage('\t\r\n\f\v image/png \v\f\n\r\t')).toBe(true)
  })

  it('trims ASCII space only, as the shim does', () => {
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

  it('compares the whole string, as libsession does: no parameters, no space', () => {
    expect(isDisplayableImage('image/jpeg; charset=binary')).toBe(false)
    expect(isDisplayableImage(' image/png')).toBe(false)
  })
})

describe('a viewable type’s kind', () => {
  it('is video only for a viewable video', () => {
    expect(mediaKindOf('video/webm')).toBe('video')
    expect(mediaKindOf('image/gif')).toBe('image')
  })
})
