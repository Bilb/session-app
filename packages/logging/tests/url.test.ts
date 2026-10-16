import { describe, expect, it } from 'vitest'

import { renderUrl } from '#src/url'

import { pseudonyms } from './helpers'

describe('renderUrl', () => {
  const p = pseudonyms()

  it("keeps Session's own hosts and pseudonymises ids in their paths", () => {
    const id = 'aBcDeFgHiJkLmNoPqRsTuVwXyZ012345'
    expect(renderUrl(`https://filev2.getsession.org/file/${id}`, p)).toBe(
      `https://filev2.getsession.org/file/${p.of(id)}`,
    )
  })

  it('hides any other host and every path segment but the API words', () => {
    const rendered = renderUrl(
      'https://open.example.org/room/lokinet/messages/since/12345678?t=r&public_key=a03c#x',
      p,
    )
    expect(rendered).toBe(
      `https://${p.of('open.example.org')}/room/${p.of('lokinet')}/messages/since/${p.of('12345678')}?<2>`,
    )
    expect(rendered).not.toContain('lokinet')
    expect(rendered).not.toContain('a03c')
  })

  it('writes an IP host as its class', () => {
    expect(renderUrl('http://144.76.164.202:22021/storage_rpc/v1', p)).toBe(
      'http://<v4 public:22021>/storage_rpc/v1',
    )
    expect(renderUrl('https://[::ffff:10.0.0.2]:443/', p)).toBe('https://<v6-mapped private:443>/')
  })

  it('drops credentials', () => {
    expect(renderUrl('https://user:secret@filev2.getsession.org/', p)).toBe(
      'https://filev2.getsession.org/',
    )
  })

  it('is undefined for text that is not a URL', () => {
    expect(renderUrl('not a url', p)).toBeUndefined()
  })
})
