import { describe, expect, it } from 'vitest'

import { PreviewGrants } from '#src/main/previewGrants'

describe('which staged files the media scheme may preview', () => {
  it('allows only a path the preload granted, and answers its url', () => {
    const grants = new PreviewGrants()
    expect(grants.grant('/home/a/été.jpg')).toBe(
      'session-media://staged/%2Fhome%2Fa%2F%C3%A9t%C3%A9.jpg',
    )
    expect(grants.allows('/home/a/été.jpg')).toBe(true)
    expect(grants.allows('/home/a/other.jpg')).toBe(false)
  })

  it('grants nothing the scheme cannot carry', () => {
    const grants = new PreviewGrants()
    for (const path of [undefined, 42, '', 'a.jpg', '\\\\host\\share\\a.jpg', '/a/../b.jpg']) {
      expect(grants.grant(path), String(path)).toBeNull()
    }
  })

  it('forgets the oldest grant once it holds 128', () => {
    const grants = new PreviewGrants()
    for (let i = 0; i <= 128; i += 1) grants.grant(`/staged/${String(i)}.jpg`)
    expect(grants.allows('/staged/0.jpg')).toBe(false)
    expect(grants.allows('/staged/1.jpg')).toBe(true)
    expect(grants.allows('/staged/128.jpg')).toBe(true)
  })

  it('counts a granted path again as the newest', () => {
    const grants = new PreviewGrants()
    for (let i = 0; i < 128; i += 1) grants.grant(`/staged/${String(i)}.jpg`)
    grants.grant('/staged/0.jpg')
    grants.grant('/staged/new.jpg')
    expect(grants.allows('/staged/0.jpg')).toBe(true)
    expect(grants.allows('/staged/1.jpg')).toBe(false)
  })
})
