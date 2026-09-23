import { describe, expect, it } from 'vitest'

import {
  contentSecurityPolicy,
  hardenedWebPreferences,
  isAppNavigation,
  shouldProtectContent,
} from '#src/main/security'

describe('the renderer window', () => {
  it('grants nothing the renderer does not need', () => {
    expect(hardenedWebPreferences({ packaged: true })).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
    })
  })

  it('keeps devtools out of a shipped build', () => {
    expect(hardenedWebPreferences({ packaged: true }).devTools).toBe(false)
    expect(hardenedWebPreferences({ packaged: false }).devTools).toBe(true)
  })

  it('keeps the window out of screen captures where the OS can', () => {
    expect(shouldProtectContent('win32')).toBe(true)
    expect(shouldProtectContent('darwin')).toBe(false)
    expect(shouldProtectContent('linux')).toBe(false)
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
      expect(policy).toContain("frame-src 'none'")
      expect(policy).toContain("base-uri 'none'")
      expect(policy).toContain("form-action 'none'")
    }
  })

  it('names the sources that have no fallback under default-src', () => {
    // These are the whole of the policy for their kind: `default-src 'none'` refuses media and
    // frames outright, so leaving either unnamed is a decision made by omission. Media is the one
    // that bites - an attachment is played from a blob the renderer built.
    for (const dev of [true, false]) {
      expect(contentSecurityPolicy({ dev })).toContain("media-src 'self' blob:")
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
