import { describe, expect, it } from 'vitest'

import { isOpenableUrl, isPlausibleAddress, urlToOpen } from '#src/externalUrl'

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

  it('refuses a real scheme hidden further along the string', () => {
    expect(isOpenableUrl('javascript:void("https://ok")')).toBe(false)
  })
})

/**
 * What happens to an address with no scheme on it.
 *
 * Both mobile clients upgrade one rather than refusing it, and both pick https rather than the
 * http a parser would default to -- iOS says why in as many words: it is the only scheme it will
 * load a preview for. Somebody who typed `getsession.org` meant a website.
 */
describe('an address with no scheme', () => {
  it('becomes https', () => {
    expect(urlToOpen('getsession.org')).toBe('https://getsession.org')
    expect(urlToOpen('example.com/faq?a=1#b')).toBe('https://example.com/faq?a=1#b')
  })

  it('is read as a host and a port rather than as a scheme, where it could be either', () => {
    // RFC 3986 lets a scheme contain a dot, so `example.com:8080` parses as a scheme of
    // `example.com`. A dot is what tells the two apart.
    expect(urlToOpen('example.com:8080/x')).toBe('https://example.com:8080/x')
  })

  it('is left alone when it already has one', () => {
    expect(urlToOpen('http://example.com')).toBe('http://example.com')
    expect(urlToOpen('HTTPS://getsession.org')).toBe('HTTPS://getsession.org')
  })

  it('is not a way to make any string openable', () => {
    // The upgrade applies to something that already looks like a host, not to whatever arrives.
    for (const text of ['', '   ', 'not a url', 'hello', '/faq', '#anchor', 'a b.com']) {
      expect(urlToOpen(text), JSON.stringify(text)).toBeNull()
    }
  })

  it('does not rescue a scheme that says what it is', () => {
    // `javascript:` is not an address that was missing its protocol.
    for (const text of ['javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.com']) {
      expect(urlToOpen(text), text).toBeNull()
    }
  })

  it('opens what was checked rather than what came in', () => {
    // Surrounding whitespace is taken off before the check, so the two cannot disagree.
    expect(urlToOpen('  https://getsession.org  ')).toBe('https://getsession.org')
  })
})

/**
 * Addresses that read as one destination and resolve to another.
 *
 * A scheme check says a link may be opened; this says it is what it looks like. Each case is a
 * way of writing an address that renders convincingly and goes somewhere else, and none of them
 * is a URL anybody types on purpose.
 */
describe('an address that is not what it reads as', () => {
  it('refuses userinfo standing in for the host', () => {
    // The part everybody reads is the part that is ignored: this goes to evil.example.
    expect(isPlausibleAddress('https://getsession.org@evil.example')).toBe(false)
    expect(urlToOpen('https://getsession.org@evil.example')).toBeNull()
    expect(isPlausibleAddress('https://user:pass@evil.example/path')).toBe(false)
  })

  it('refuses a host written in two scripts', () => {
    // Cyrillic `а` renders as Latin `a`. A real domain does not mix; the mixture is the signal.
    expect(isPlausibleAddress('https://\u0430pple.com')).toBe(false)
    expect(isPlausibleAddress('https://g\u043eogle.com/x')).toBe(false)
  })

  it('takes a host written wholly in one non-Latin script', () => {
    // The check is mixture, not non-ASCII: a Greek site is Greek throughout.
    expect(
      isPlausibleAddress(
        'https://\u03c0\u03b1\u03c1\u03ac\u03b4\u03b5\u03b9\u03b3\u03bc\u03b1.\u03b4\u03bf\u03ba\u03b9\u03bc\u03ae',
      ),
    ).toBe(true)
  })

  it('takes a Latin name on a non-Latin top level domain', () => {
    // Scripts may differ across the dots -- the substitution happens inside a word, so that is
    // where a mixture means anything. Judged per host, these real addresses would be refused.
    expect(isPlausibleAddress('https://session.\u0440\u0444')).toBe(true)
    expect(isPlausibleAddress('https://shop.example.\u4e2d\u56fd')).toBe(true)
  })

  it('refuses a host that is not a host', () => {
    for (const url of [
      'https://',
      'https://localhost',
      'https://.com',
      'https://example..com',
      'https://exa%6dple.com',
    ]) {
      expect(isPlausibleAddress(url), url).toBe(false)
    }
  })

  it('refuses characters RFC 3986 does not allow after the authority', () => {
    expect(isPlausibleAddress('https://example.com/a\nb')).toBe(false)
    expect(isPlausibleAddress('https://example.com/a b')).toBe(false)
    expect(isPlausibleAddress('https://example.com/\u0000')).toBe(false)
  })

  it('bounds the length of both the link and its host', () => {
    expect(isPlausibleAddress(`https://example.com/${'a'.repeat(4096)}`)).toBe(false)
    expect(isPlausibleAddress(`https://${'a'.repeat(2049)}.com`)).toBe(false)
  })

  it('still takes the addresses the app actually opens', () => {
    for (const url of [
      'https://getsession.org',
      'https://getsession.org/terms-of-service',
      'https://example.com:8080/a/b?c=d&e=f#g',
      'http://example.com/~user/(a)',
    ]) {
      expect(isPlausibleAddress(url), url).toBe(true)
    }
  })
})
