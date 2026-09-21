import { requirePorts } from './ports'

/** Plain http as well as https, and case-insensitively: a scheme is not case-sensitive. */
const OPENABLE = /^https?:\/\//i

/**
 * Something a URL parser would read as a scheme.
 *
 * RFC 3986 allows a dot in one, so `example.com:8080` is syntactically a scheme of
 * `example.com`. A dot is what tells a scheme from a host and a port.
 */
const HAS_SCHEME = /^[A-Za-z][A-Za-z0-9+-]*:/

/** A bare host, at minimum: a dot inside it, no spaces, and something before the first slash. */
const LOOKS_LIKE_HOST = /^[^\s/?#]+\.[^\s/?#]+/

/** The legacy desktop client's caps. Neither is a meaningful address at that length. */
const MAX_URL_LENGTH = 4096
const MAX_HOST_LENGTH = 2048

/** Everything RFC 3986 allows after the authority: unreserved, pct-encoded, sub-delims, `:@/?#`. */
const RFC3986_TAIL = /^[A-Za-z0-9\-._~%!$&'()*+,;=:@/?#[\]]*$/

/**
 * Whether any one label mixes scripts.
 *
 * **Per label, not per host.** The homograph substitutes a character inside a word -- Cyrillic
 * `а` for Latin `a` in `аpple` -- so the mixture that matters is within a label. A host may
 * legitimately span scripts across the dots: `session.\u0440\u0444` is a Latin name on a Cyrillic
 * TLD, and refusing it would refuse a real address to catch nothing.
 *
 * Judged on the host as written -- a punycode label is pure ASCII and passes unexamined. See
 * *Links leaving the app* in `docs/ARCHITECTURE.md`.
 */
function mixesScripts(host: string): boolean {
  return host.split('.').some((label) => {
    // By code point rather than by a character range, which would need a control character in
    // the pattern to say "not ASCII".
    const nonAscii = [...label].some((character) => (character.codePointAt(0) ?? 0) > 0x7f)
    return nonAscii && /[A-Za-z]/.test(label)
  })
}

/**
 * Whether the address is what it reads as.
 *
 * Each rule refuses a way of writing an address that renders as one destination and resolves to
 * another; `docs/ARCHITECTURE.md` says which and why. Written against the string rather than a
 * parsed `URL`, because react-native ships an incomplete one.
 */
export function isPlausibleAddress(url: string): boolean {
  if (url.length > MAX_URL_LENGTH) return false

  const afterScheme = url.replace(OPENABLE, '')
  const authority = afterScheme.split(/[/?#]/, 1)[0] ?? ''
  const tail = afterScheme.slice(authority.length)

  if (authority.includes('@')) return false

  const host = authority.replace(/:\d*$/, '')
  if (host.length === 0 || host.length > MAX_HOST_LENGTH) return false
  if (host.includes('%')) return false
  if (mixesScripts(host)) return false

  const labels = host.split('.')
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return false

  return RFC3986_TAIL.test(tail)
}

/**
 * The URL to open for this text, or null if there is none.
 *
 * A missing scheme becomes https, and only where the text already looks like a host: this is
 * not a way to make any string openable. A scheme that is present and is not http(s) is refused
 * rather than upgraded.
 */
export function urlToOpen(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const withScheme = HAS_SCHEME.test(trimmed)
    ? OPENABLE.test(trimmed)
      ? trimmed
      : null
    : LOOKS_LIKE_HOST.test(trimmed)
      ? `https://${trimmed}`
      : null
  if (withScheme === null) return null
  return isPlausibleAddress(withScheme) ? withScheme : null
}

/** Whether the app would open this. */
export function isOpenableUrl(text: string): boolean {
  return urlToOpen(text) !== null
}

/**
 * Hands a URL to the OS, or refuses it.
 *
 * **The one way out, so the check cannot be gone round** -- see *Links leaving the app* in
 * `docs/ARCHITECTURE.md`. What is opened is what `urlToOpen` returned, so the scheme the OS is
 * handed is the one that was checked.
 *
 * Returns whether it went, rather than throwing: a refusal is a bug in the caller, and the
 * screen carries on closing either way.
 */
export async function openExternalUrl(text: string): Promise<boolean> {
  const url = urlToOpen(text)
  if (url === null) return false
  await requirePorts().linking.openUrl(url)
  return true
}
