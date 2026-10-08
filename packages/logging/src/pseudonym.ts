import { hmacSha256, toHex, utf8 } from './sha256'

/** Six hex digits: enough that two ids in one log rarely share one, short enough to scan. */
const DIGITS = 6

/** Past this many distinct ids the cache starts again rather than growing without bound. */
const CACHE_LIMIT = 4096

/**
 * Stand-ins for internal identifiers: `~3fa9c1` for a service node, a message hash, a file id.
 *
 * Reading a log needs to know that two lines name **the same** thing, never what it is, so an id
 * is replaced by a keyed hash of itself. The key is a random salt kept beside the logs and never
 * exported, so somebody holding an export cannot hash a guessed id and look for it. The same salt
 * for the life of the log directory keeps a pseudonym stable across every file a reader is given.
 */
export class Pseudonyms {
  readonly #salt: Uint8Array
  readonly #seen = new Map<string, string>()

  constructor(salt: Uint8Array) {
    if (salt.length < 16) throw new Error('a pseudonym salt needs at least 16 bytes')
    this.#salt = salt
  }

  of(raw: string): string {
    const known = this.#seen.get(raw)
    if (known !== undefined) return known
    if (this.#seen.size >= CACHE_LIMIT) this.#seen.clear()
    const rendered = `~${toHex(hmacSha256(this.#salt, utf8(raw))).slice(0, DIGITS)}`
    this.#seen.set(raw, rendered)
    return rendered
  }
}
