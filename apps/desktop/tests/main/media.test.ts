import { describe, expect, it } from 'vitest'

import { parseMediaUrl } from '#src/main/media'
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
