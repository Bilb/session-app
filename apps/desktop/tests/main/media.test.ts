import { describe, expect, it } from 'vitest'

import { parseMediaUrl, servableContentType } from '#src/main/media'
import { MEDIA_SCHEME, mediaUrl } from '#src/shared/mediaUrl'

/**
 * The renderer names a message and a position and gets bytes back, so this parser is the whole of
 * what it may ask for. Everything it refuses is something the renderer cannot reach.
 */
describe('a media url', () => {
  it('parses back exactly what the renderer builds', () => {
    for (const kind of ['attachment', 'preview'] as const) {
      for (const ref of [
        { messageId: 1, index: 0 },
        { messageId: 42, index: 7 },
        { messageId: Number.MAX_SAFE_INTEGER, index: 0 },
      ]) {
        expect(parseMediaUrl(mediaUrl(kind, ref))).toEqual({ kind, ref })
      }
    }
  })

  it('names a message and a position under each authority', () => {
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/1`)).toEqual({
      kind: 'attachment',
      ref: { messageId: 42, index: 1 },
    })
    expect(parseMediaUrl(`${MEDIA_SCHEME}://preview/42/0`)).toEqual({
      kind: 'preview',
      ref: { messageId: 42, index: 0 },
    })
  })

  it('refuses another scheme, whatever its shape', () => {
    expect(parseMediaUrl('file:///etc/passwd')).toBeNull()
    expect(parseMediaUrl('https://attachment/42/1')).toBeNull()
  })

  it('refuses an authority it does not serve', () => {
    // A standard scheme gets the special-scheme host parser, so anything here is a host name
    // rather than a path segment. Only the two words are doors.
    expect(parseMediaUrl(`${MEDIA_SCHEME}://thumbnail/42/1`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://42/1`)).toBeNull()
  })

  it('refuses anything longer than the pair', () => {
    // Nothing below the pair is addressable, so a third segment is not a path to reach for.
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/1/original`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42`)).toBeNull()
  })

  it('refuses ids that are not whole and positive', () => {
    // A message id is a rowid, so zero and negatives name nothing; an index counts from zero.
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/0/1`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/-1/0`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/-1`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/4.2/0`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/nine/0`)).toBeNull()
  })

  it('refuses anything but plain decimal ids', () => {
    for (const pair of ['42/', '0x2A/1e1', '+42/-0', '1e300/0', '042/1', '42/01', '%34%32/1']) {
      expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/${pair}`), pair).toBeNull()
    }
  })

  it('refuses an id past the largest safe integer', () => {
    // 2^53 + 1, which Number() rounds to 2^53 rather than refusing.
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/9007199254740993/0`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/9007199254740993`)).toBeNull()
  })

  it('refuses a query or a fragment', () => {
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/1?x=1`)).toBeNull()
    expect(parseMediaUrl(`${MEDIA_SCHEME}://attachment/42/1#f`)).toBeNull()
  })

  it('refuses a url that does not parse at all', () => {
    expect(parseMediaUrl('')).toBeNull()
    expect(parseMediaUrl('not a url')).toBeNull()
  })
})

function ascii(text: string, length = 16): Uint8Array {
  const out = new Uint8Array(Math.max(length, text.length))
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i)
  return out
}

const PNG = ascii('\x89PNG\r\n\x1a\n\0\0\0\rIHDR')
const JPEG = ascii('\xff\xd8\xff\xe0\0\x10JFIF')
const GIF = ascii('GIF89a')
const WEBP = ascii('RIFF\x24\0\0\0WEBPVP8 ')
const BMP = ascii('BM\x36\0\0\0')
const MP4 = ascii('\0\0\0\x18ftypmp42')
const WEBM = ascii('\x1a\x45\xdf\xa3')
const OGG = ascii('OggS\0\x02')
const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

describe('what the media scheme will serve', () => {
  it('serves each viewable format whose bytes match', () => {
    const cases: [string, Uint8Array, string][] = [
      ['image/png', PNG, 'image/png'],
      ['image/jpeg', JPEG, 'image/jpeg'],
      ['image/jpg', JPEG, 'image/jpeg'],
      ['image/gif', GIF, 'image/gif'],
      ['image/webp', WEBP, 'image/webp'],
      ['image/bmp', BMP, 'image/bmp'],
      ['video/mp4', MP4, 'video/mp4'],
      ['video/webm', WEBM, 'video/webm'],
      ['video/ogg', OGG, 'video/ogg'],
      ['Image/PNG; charset=binary', PNG, 'image/png'],
    ]
    for (const [declared, bytes, served] of cases) {
      expect(servableContentType(declared, bytes), declared).toBe(served)
    }
  })

  it('serves what the bytes are when the sender named the wrong image format', () => {
    expect(servableContentType('image/png', JPEG)).toBe('image/jpeg')
  })

  it('refuses SVG whatever the bytes are', () => {
    expect(servableContentType('image/svg+xml', SVG)).toBeNull()
    expect(servableContentType('image/svg+xml', PNG)).toBeNull()
  })

  it('refuses a type that is not viewable', () => {
    expect(servableContentType('application/octet-stream', PNG)).toBeNull()
    expect(servableContentType('text/html', PNG)).toBeNull()
    expect(servableContentType('', PNG)).toBeNull()
  })

  it('refuses bytes that are not the declared family', () => {
    expect(servableContentType('image/png', SVG)).toBeNull()
    expect(servableContentType('image/png', ascii('<html><script>'))).toBeNull()
    expect(servableContentType('image/png', MP4)).toBeNull()
    expect(servableContentType('video/mp4', PNG)).toBeNull()
  })

  it('refuses bytes too short to carry a signature', () => {
    expect(servableContentType('image/png', new Uint8Array())).toBeNull()
    expect(servableContentType('image/png', PNG.subarray(0, 4))).toBeNull()
    expect(servableContentType('image/webp', ascii('RIFF', 4))).toBeNull()
  })
})
