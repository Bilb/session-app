import { describe, expect, it } from 'vitest'

import { PreviewGrants } from '#src/main/previewGrants'

const PICKED = /^session-media:\/\/picked\/[0-9a-f]{32}$/

describe('which staged files the media scheme may preview', () => {
  it('serves only the path behind a url it granted', () => {
    const grants = new PreviewGrants()
    const url = grants.grant('/home/a/été.jpg')
    expect(url).toMatch(PICKED)
    expect(grants.pathFor(url ?? '')).toBe('/home/a/été.jpg')
    expect(grants.pathFor('session-media://picked/0123456789abcdef0123456789abcdef')).toBeNull()
    expect(grants.names('session-media://picked/anything')).toBe(true)
    expect(grants.names('session-media://staged/%2Fa.jpg')).toBe(false)
  })

  it('gives a file picked again a url of its own, so a changed file is not drawn from cache', () => {
    const grants = new PreviewGrants()
    const first = grants.grant('/home/a/x.jpg')
    const again = grants.grant('/home/a/x.jpg')
    expect(again).not.toBe(first)
    expect(grants.pathFor(first ?? '')).toBe('/home/a/x.jpg')
    expect(grants.pathFor(again ?? '')).toBe('/home/a/x.jpg')
  })

  it('takes a grant back, and ignores what it never gave', () => {
    const grants = new PreviewGrants()
    const url = grants.grant('/home/a/x.jpg') ?? ''
    grants.revoke('session-media://staged/%2Fhome%2Fa%2Fx.jpg')
    grants.revoke(42)
    expect(grants.pathFor(url)).toBe('/home/a/x.jpg')
    grants.revoke(url)
    expect(grants.pathFor(url)).toBeNull()
  })

  it('grants nothing the scheme refuses', () => {
    const grants = new PreviewGrants()
    for (const path of [
      undefined,
      42,
      '',
      'a.jpg',
      '\\\\host\\share\\a.jpg',
      '/\\host\\share\\a.jpg',
      '/a/../b.jpg',
    ]) {
      expect(grants.grant(path), String(path)).toBeNull()
    }
  })

  it('forgets the oldest grant once it holds 128', () => {
    const grants = new PreviewGrants()
    const urls = Array.from(
      { length: 129 },
      (_, i) => grants.grant(`/staged/${String(i)}.jpg`) ?? '',
    )
    expect(grants.pathFor(urls[0] ?? '')).toBeNull()
    expect(grants.pathFor(urls[1] ?? '')).toBe('/staged/1.jpg')
    expect(grants.pathFor(urls[128] ?? '')).toBe('/staged/128.jpg')
  })
})
