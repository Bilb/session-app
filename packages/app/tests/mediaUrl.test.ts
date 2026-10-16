import { isStagedPath } from '@session/basic-types'
import { MEDIA_URL_VECTORS } from '@session/client-contract'
import { describe, expect, it } from 'vitest'

import { mediaUrl, parseMediaUrl, stagedThumbnailUrl } from '#src/mediaUrl'

/**
 * A loader names a message and a position and gets bytes back, so this parser is the whole of
 * what a URL may ask for. The shim's parser answers the same vectors in bridge-node's tests.
 */
describe('a media url', () => {
  it('parses back exactly what the app builds', () => {
    for (const kind of ['attachment', 'thumbhash', 'thumbnail'] as const) {
      for (const ref of [
        { messageId: 1, index: 0 },
        { messageId: 42, index: 7 },
        { messageId: Number.MAX_SAFE_INTEGER, index: Number.MAX_SAFE_INTEGER },
      ]) {
        expect(parseMediaUrl(mediaUrl(kind, ref))).toEqual({ kind, ref })
      }
    }
  })

  it('accepts and refuses what every parser of the scheme does', () => {
    for (const { url, parsed } of MEDIA_URL_VECTORS) {
      const expected =
        parsed === null || parsed.kind === 'staged'
          ? parsed
          : { kind: parsed.kind, ref: { messageId: parsed.messageId, index: parsed.index } }
      expect(parseMediaUrl(url), url).toEqual(expected)
    }
  })

  it('builds the one url a staged path has, and parses the path back', () => {
    for (const path of [
      '/home/a/photo.jpg',
      '/home/a/\u0424\u043e\u0442\u043e/\u00e7\u00e0 \u65e5\u672c (1).jpg',
      '/tmp/\u{1f4f7}#?%.png',
      'C:\\Users\\Zo\u00eb\\x.png',
      'C:/x.png',
    ]) {
      const url = stagedThumbnailUrl(path)
      expect(url, path).not.toBeNull()
      expect(parseMediaUrl(url ?? ''), path).toEqual({ kind: 'staged', path })
    }
  })

  it('builds no url for a path the shim refuses', () => {
    for (const path of [
      'a.jpg',
      '//host/a.jpg',
      '\\\\server\\share\\a.jpg',
      '\\a.jpg',
      '/a/../b.jpg',
      '/a\0b.jpg',
      '/a\ud800.jpg',
      `/${'a'.repeat(4096)}`,
    ]) {
      expect(isStagedPath(path), path).toBe(false)
      expect(stagedThumbnailUrl(path), path).toBeNull()
    }
  })
})
