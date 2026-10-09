import { renderAddress } from './address'
import type { Pseudonyms } from './pseudonym'
import { renderUrl } from './url'

/**
 * How a typed value is taken apart to cross from the desktop renderer to main, which renders it.
 *
 * A symbol private to this module, so the raw form stays out of reach of every log call: only
 * `toWire` can take a value apart, and `fromWire` puts it back together.
 */
const TO_WIRE = Symbol('toWire')

/** A typed value as plain data. Holds the raw input, so it only ever travels to the logger. */
export type WireRedacted =
  | { redacted: 'visible'; raw: string }
  | { redacted: 'internal'; raw: string; kind?: string }
  | { redacted: 'address'; host: string; port?: number }
  | { redacted: 'url'; raw: string }

/** A field value as plain data, the form a `LogRecord` carries. */
export type WireValue = string | number | boolean | null | WireRedacted

/**
 * A value that knows how it may be written down, and keeps what it may not.
 *
 * **The raw form is unreachable from here on.** Each subclass holds its input in a private field
 * with no accessor, so a log call can hand one over but cannot reach back through it - which is
 * exactly where legacy Android's typed truncation leaked: right type, and code that took `.hex`
 * off it. Rendering needs the logger's pseudonyms, so it happens inside the logger and nowhere
 * else.
 */
export abstract class Redacted {
  abstract render(pseudonyms: Pseudonyms): string
  /** Its plain form, for the desktop renderer to hand to main, which renders it: see `TO_WIRE`. */
  abstract [TO_WIRE](): WireRedacted
}

/** An id the person can see in the app, so a reader can match either end against a screenshot. */
class UserVisibleId extends Redacted {
  readonly #raw: string
  constructor(raw: string) {
    super()
    this.#raw = raw
  }
  render(pseudonyms: Pseudonyms): string {
    return shortenVisible(this.#raw) ?? pseudonyms.of(this.#raw)
  }
  [TO_WIRE](): WireRedacted {
    return { redacted: 'visible', raw: this.#raw }
  }
}

/** An id nobody is shown, so only its equality with others matters. */
class InternalId extends Redacted {
  readonly #raw: string
  readonly #kind: string | undefined
  constructor(raw: string, kind: string | undefined) {
    super()
    this.#raw = raw
    this.#kind = kind
  }
  render(pseudonyms: Pseudonyms): string {
    const pseudonym = pseudonyms.of(this.#raw)
    return this.#kind === undefined ? pseudonym : `${this.#kind}${pseudonym}`
  }
  [TO_WIRE](): WireRedacted {
    return this.#kind === undefined
      ? { redacted: 'internal', raw: this.#raw }
      : { redacted: 'internal', raw: this.#raw, kind: this.#kind }
  }
}

class NetAddress extends Redacted {
  readonly #host: string
  readonly #port: number | undefined
  constructor(host: string, port: number | undefined) {
    super()
    this.#host = host
    this.#port = port
  }
  render(): string {
    return renderAddress(this.#host, this.#port)
  }
  [TO_WIRE](): WireRedacted {
    return this.#port === undefined
      ? { redacted: 'address', host: this.#host }
      : { redacted: 'address', host: this.#host, port: this.#port }
  }
}

class LogUrl extends Redacted {
  readonly #raw: string
  constructor(raw: string) {
    super()
    this.#raw = raw
  }
  render(pseudonyms: Pseudonyms): string {
    return renderUrl(this.#raw, pseudonyms) ?? `url${pseudonyms.of(this.#raw)}`
  }
  [TO_WIRE](): WireRedacted {
    return { redacted: 'url', raw: this.#raw }
  }
}

/** The 2-character prefixes Session puts on a 64-hex key to say what kind of key it is. */
const KEY_PREFIX = /^(05|03|15|25)[0-9a-f]{64}$/i

/**
 * `05ab12...cd90`: prefix and four, then the last four.
 *
 * The prefix alone says nothing - every account starts `05` - so it is kept on top of the four
 * rather than instead of them. Undefined for anything that is not a prefixed key, which a caller
 * then treats as internal.
 */
export function shortenVisible(raw: string): string | undefined {
  if (!KEY_PREFIX.test(raw)) return undefined
  const lower = raw.toLowerCase()
  return `${lower.slice(0, 6)}...${lower.slice(-4)}`
}

/** An Account ID or group ID: shown in the app, so written as `05ab12...cd90`. */
export function accountId(raw: string): Redacted {
  return new UserVisibleId(raw)
}

/**
 * An identifier nobody is shown in full - a service node key, a message hash, a file id, a
 * request id - written as a pseudonym, `~3fa9c1`, or `snode~3fa9c1` with a kind.
 */
export function internalId(raw: string, kind?: string): Redacted {
  return new InternalId(raw, kind)
}

/** An IP address, written as its family and class: `v4 public:22021`. */
export function address(host: string, port?: number): Redacted {
  return new NetAddress(host, port)
}

/** A URL, with Session's hosts in clear and everything that identifies replaced. */
export function url(raw: string): Redacted {
  return new LogUrl(raw)
}

/**
 * What a key=value pair may hold.
 *
 * No `string` that could be an identifier gets past the sweep, and the types above are how one is
 * written on purpose; there is deliberately no type for a message body, a name, a filename or a
 * recovery phrase, because none of them has a form that may be written down.
 */
export type LogValue = string | number | boolean | null | undefined | Redacted

export type LogFields = Readonly<Record<string, LogValue>>

/** A field value as plain data; `undefined` is left out, which is how it would be written. */
export function toWire(value: LogValue): WireValue | undefined {
  if (value instanceof Redacted) return value[TO_WIRE]()
  return value
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * A field value back from plain data, or undefined for anything that is not one.
 *
 * Its input comes from the desktop renderer, the less trusted process, so nothing is assumed: an
 * object that is not exactly a typed value is refused rather than written.
 */
export function fromWire(value: unknown): LogValue | undefined {
  if (value === null || isString(value) || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'object') return undefined
  const wire = value as Partial<Record<string, unknown>>
  switch (wire['redacted']) {
    case 'visible':
      return isString(wire['raw']) ? accountId(wire['raw']) : undefined
    case 'internal':
      if (!isString(wire['raw'])) return undefined
      return isString(wire['kind'])
        ? internalId(wire['raw'], wire['kind'])
        : internalId(wire['raw'])
    case 'address': {
      if (!isString(wire['host'])) return undefined
      const port = wire['port']
      return typeof port === 'number' && Number.isInteger(port)
        ? address(wire['host'], port)
        : address(wire['host'])
    }
    case 'url':
      return isString(wire['raw']) ? url(wire['raw']) : undefined
    default:
      return undefined
  }
}
