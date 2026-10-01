import { describe, expect, it } from 'vitest'

import type { Session } from 'electron'

import {
  acceptsCopy,
  contentSecurityPolicy,
  denyAllPermissions,
  hardenedWebPreferences,
  isAppNavigation,
  isFromAppFrame,
  MAX_COPY_CHARS,
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

  it('loads images only from the app and the media scheme', () => {
    for (const dev of [true, false]) {
      const imgSrc = contentSecurityPolicy({ dev })
        .split('; ')
        .find((directive) => directive.startsWith('img-src '))
      expect(imgSrc).toBe("img-src 'self' session-media:")
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

describe('permissions', () => {
  type RequestHandler = (
    contents: unknown,
    permission: string,
    grant: (ok: boolean) => void,
  ) => void
  type CheckHandler = (contents: unknown, permission: string) => boolean

  function installed(): { request: RequestHandler; check: CheckHandler } {
    let request: RequestHandler | null = null
    let check: CheckHandler | null = null
    denyAllPermissions({
      setPermissionRequestHandler: (handler: RequestHandler) => (request = handler),
      setPermissionCheckHandler: (handler: CheckHandler) => (check = handler),
    } as unknown as Session)
    if (request === null || check === null) throw new Error('a handler was not installed')
    return { request, check }
  }

  it.each([
    'clipboard-sanitized-write',
    'clipboard-read',
    'notifications',
    'media',
    'openExternal',
  ])('refuses %s, when asked and when checked', (permission) => {
    const { request, check } = installed()
    let granted: boolean | null = null
    request(null, permission, (ok) => (granted = ok))
    expect(granted).toBe(false)
    expect(check(null, permission)).toBe(false)
  })
})

describe('the sender of an IPC message', () => {
  const appUrl = 'file:///opt/session/resources/app/out/renderer/index.html'
  const mainFrame = { url: appUrl, parent: null }

  it('is the app when it is the main frame showing the app', () => {
    expect(isFromAppFrame(mainFrame, appUrl)).toBe(true)
  })

  it('is not the app when it is a subframe, another page, or gone', () => {
    expect(isFromAppFrame({ url: appUrl, parent: mainFrame } as never, appUrl)).toBe(false)
    expect(isFromAppFrame({ url: 'https://example.com/', parent: null }, appUrl)).toBe(false)
    expect(isFromAppFrame(null, appUrl)).toBe(false)
  })
})

describe('a copy the renderer asks for', () => {
  const focused = { focused: true }

  it('is written for the focused window', () => {
    expect(acceptsCopy('https://getsession.org/faq', focused)).toBe(true)
    expect(acceptsCopy('x'.repeat(MAX_COPY_CHARS), focused)).toBe(true)
  })

  it.each([
    ['not text', 42, focused],
    ['too long', 'x'.repeat(MAX_COPY_CHARS + 1), focused],
    ['from an unfocused window', 'x', { focused: false }],
  ])('is refused when %s', (_case, text, state) => {
    expect(acceptsCopy(text, state)).toBe(false)
  })
})
