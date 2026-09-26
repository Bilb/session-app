import { describe, expect, it } from 'vitest'

import { MEDIA_SCHEME, parseMediaUrl } from '#src/main/media'

/**
 * The renderer names a message and a position and gets bytes back, so this parser is the whole of
 * what it may ask for. Everything it refuses is something the renderer cannot reach.
 */
describe('a media url', () => {
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

  it('refuses a url that does not parse at all', () => {
    expect(parseMediaUrl('')).toBeNull()
    expect(parseMediaUrl('not a url')).toBeNull()
  })
})
