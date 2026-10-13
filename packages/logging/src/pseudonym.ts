import { hmacSha256, toHex, utf8 } from './sha256'

/**
 * Eight hex digits, 32 bits: two of 4,096 ids share a pseudonym about 0.2% of the time, where six
 * digits would make it 39%, and a grep for one finds another id about n / 2^32 of the time.
 */
const DIGITS = 8

/** The most ids remembered; past it the one used longest ago is forgotten. */
const CACHE_LIMIT = 4096

/**
 * Stand-ins for internal identifiers: `~3fa9c1de` for a service node, a message hash, a file id.
 *
 * Reading a log needs to know that two lines name **the same** thing, never what it is, so an id
 * is replaced by a keyed hash of itself. The key is a random salt kept beside the logs and never
 * exported, so somebody holding an export cannot hash a guessed id and look for it. The same salt
 * for the life of the log directory keeps a pseudonym stable across every file a reader is given.
 */
export class Pseudonyms {
  readonly #salt: Uint8Array
  /** Oldest use first: a `Map` keeps insertion order, and a hit is moved to the end. */
  readonly #seen = new Map<string, string>()

  constructor(salt: Uint8Array) {
    if (salt.length < 16) throw new Error('a pseudonym salt needs at least 16 bytes')
    this.#salt = salt
  }

  of(raw: string): string {
    const known = this.#seen.get(raw)
    if (known !== undefined) {
      this.#seen.delete(raw)
      this.#seen.set(raw, known)
      return known
    }
    if (this.#seen.size >= CACHE_LIMIT) {
      const oldest = this.#seen.keys().next()
      if (oldest.done !== true) this.#seen.delete(oldest.value)
    }
    const rendered = `~${toHex(hmacSha256(this.#salt, utf8(raw))).slice(0, DIGITS)}`
    this.#seen.set(raw, rendered)
    return rendered
  }
}
