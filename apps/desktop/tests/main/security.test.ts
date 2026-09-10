import { describe, expect, it } from 'vitest'

import { contentSecurityPolicy, hardenedWebPreferences, isAppNavigation } from '#src/main/security'

describe('the renderer window', () => {
  it('grants nothing the renderer does not need', () => {
    expect(hardenedWebPreferences).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    })
  })
})

describe('navigation', () => {
  const packaged = 'file:///opt/session/resources/app/out/renderer/index.html'
  const dev = 'http://localhost:5173/'

  it('lets the app reload itself', () => {
    expect(isAppNavigation(packaged, packaged)).toBe(true)
    expect(isAppNavigation(`${dev}?v=2`, dev)).toBe(true)
  })

  it('refuses anywhere else', () => {
    for (const target of [
      'https://example.com/',
      'http://localhost:5174/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'not a url',
    ]) {
      expect(isAppNavigation(target, packaged), target).toBe(false)
    }
  })

  it('refuses a different file even under the same directory', () => {
    expect(
      isAppNavigation('file:///opt/session/resources/app/out/renderer/other.html', packaged),
    ).toBe(false)
  })
})

describe('the content security policy', () => {
  it('allows nothing by default, and no plugins or framing anywhere', () => {
    for (const dev of [true, false]) {
      const policy = contentSecurityPolicy({ dev })
      expect(policy).toContain("default-src 'none'")
      expect(policy).toContain("object-src 'none'")
      expect(policy).toContain("frame-ancestors 'none'")
      expect(policy).toContain("base-uri 'none'")
      expect(policy).toContain("form-action 'none'")
    }
  })

  it('keeps the dev server relaxations out of the shipped policy', () => {
    const shipped = contentSecurityPolicy({ dev: false })
    expect(shipped).toContain("script-src 'self'")
    expect(shipped).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(shipped).not.toContain('ws:')

    expect(contentSecurityPolicy({ dev: true })).toContain("script-src 'self' 'unsafe-inline'")
  })
})
