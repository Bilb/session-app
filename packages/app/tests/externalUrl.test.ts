import { describe, expect, it } from 'vitest'

import { isOpenableUrl } from '#src/externalUrl'

/**
 * Which URLs the app is willing to hand to the OS.
 *
 * The check exists because `openExternal` and `Linking.openURL` both give any scheme straight to
 * the operating system: a `file:` opens a file manager, a custom scheme launches whichever app
 * claims it, and neither looks different to the person tapping the link.
 */
describe('a URL the app may open', () => {
  it('takes http and https, which is what every current client opens', () => {
    expect(isOpenableUrl('https://getsession.org')).toBe(true)
    expect(isOpenableUrl('http://example.com/faq')).toBe(true)
  })

  it('does not care how the scheme is written', () => {
    // A scheme is case-insensitive, and a link that silently does nothing is worse than one that
    // opens.
    expect(isOpenableUrl('HTTPS://getsession.org')).toBe(true)
    expect(isOpenableUrl('Http://example.com')).toBe(true)
  })

  it('refuses the schemes that launch something rather than open a page', () => {
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'sms:+1234',
      'tel:+1234',
      'session://open',
      'ftp://example.com',
    ]) {
      expect(isOpenableUrl(url), url).toBe(false)
    }
  })

  it('refuses a scheme without its slashes, which is not a URL anybody typed deliberately', () => {
    expect(isOpenableUrl('http:example.com')).toBe(false)
  })

  it('refuses anything that does not begin with a scheme at all', () => {
    // Including one that merely contains a real scheme further along.
    expect(isOpenableUrl('getsession.org')).toBe(false)
    expect(isOpenableUrl(' https://getsession.org')).toBe(false)
    expect(isOpenableUrl('javascript:void("https://ok")')).toBe(false)
  })
})
