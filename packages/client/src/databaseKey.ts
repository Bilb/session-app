/**
 * Why the database key could not be had, as the startup-failure screen needs to tell them apart.
 *
 * Each app keeps its own key -- a file sealed with safeStorage on desktop, the keychain or Keystore
 * on mobile -- and libsession takes it but never stores it, so these come from the apps rather
 * than from the bridge. They travel as a refusal's code, beside `BRIDGE_UNAVAILABLE`.
 */

/** The key is there but cannot be read now: a locked keychain, a keyring that is not running. */
export const KEY_UNAVAILABLE = 'key.unavailable'
/** There is no key, and there is a database it would have opened. */
export const KEY_MISSING = 'key.missing'
/** What was read is not a key, so it can never open the database. */
export const KEY_INVALID = 'key.invalid'

export type DatabaseKeyCode = typeof KEY_UNAVAILABLE | typeof KEY_MISSING | typeof KEY_INVALID

const CODES: readonly string[] = [KEY_UNAVAILABLE, KEY_MISSING, KEY_INVALID]

export function isDatabaseKeyCode(code: string | undefined): code is DatabaseKeyCode {
  return code !== undefined && CODES.includes(code)
}

/**
 * A key that could not be had, thrown by an app's key resolver before any bridge exists.
 *
 * Never carries the key, or any part of it: the message reaches the screen, the clipboard and the
 * log.
 */
export class DatabaseKeyError extends Error {
  override readonly name = 'DatabaseKeyError'
  readonly code: DatabaseKeyCode

  constructor(code: DatabaseKeyCode, message: string) {
    super(message)
    this.code = code
  }
}

/** The key is stored but could not be read; `detail` says what refused, never what was read. */
export function keyUnavailable(detail: string): DatabaseKeyError {
  return new DatabaseKeyError(KEY_UNAVAILABLE, `the database key could not be read: ${detail}`)
}

export function keyMissing(): DatabaseKeyError {
  return new DatabaseKeyError(KEY_MISSING, 'the database key is missing, but a database exists')
}

/** `detail` describes the shape that was wrong (a length), never the bytes. */
export function keyInvalid(detail: string): DatabaseKeyError {
  return new DatabaseKeyError(KEY_INVALID, `the database key is not a key: ${detail}`)
}
