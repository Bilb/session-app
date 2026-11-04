import type { DatabaseKeyError } from '../databaseKey'
import { SessionClientError } from '../errors'
import type { SessionClient } from '../types'

/** What a request is refused with while there is no database, worded as the bridge words it. */
export function noDatabaseOpen(reason: string): string {
  return `the bridge has no database open: ${reason}`
}

/**
 * A client whose database would not open, held the way the real bridge holds one: every request is
 * refused with the reason, except a discard, which replaces the database and lifts the refusal.
 *
 * `reason` is SQLite's text, refused as the bridge words it; or a `DatabaseKeyError`, refused as
 * the apps' keyless transport refuses it, with its code. Either way a discard lifts it, as a
 * confirmed Clear does on the real path.
 *
 * Wrapped around a working client rather than modelled inside the fake, because what it stands for
 * is the absence of everything the fake models.
 */
export function unopenable(
  client: SessionClient,
  reason: string | DatabaseKeyError,
): SessionClient {
  const refusal = () =>
    typeof reason === 'string'
      ? new Error(noDatabaseOpen(reason))
      : new SessionClientError(reason.message, reason.code)
  let refusing = true
  return new Proxy(client, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      const method = value as (...args: unknown[]) => unknown
      if (property === 'onEvent' || property === 'close') return method.bind(target)
      if (property === 'discardAccount') {
        return async (...args: unknown[]) => {
          await method.apply(target, args)
          refusing = false
        }
      }
      return (...args: unknown[]) =>
        refusing ? Promise.reject(refusal()) : method.apply(target, args)
    },
  })
}
