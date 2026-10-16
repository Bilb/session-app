/**
 * Network addresses, as what kind of address they were rather than which.
 *
 * Support has needed to see that a connection went to an IPv4 address carried in IPv6, or to a
 * private network, and that it was refused - never the octets. The octets of a service node say
 * which swarm, and so roughly which account, and the device's own say where it is.
 */

export type AddressFamily = 'v4' | 'v6' | 'v6-mapped'
export type AddressClass = 'loopback' | 'private' | 'cgnat' | 'public' | 'unspecified'

export interface AddressShape {
  family: AddressFamily
  class: AddressClass
}

function octets(text: string): number[] | undefined {
  const parts = text.split('.')
  if (parts.length !== 4) return undefined
  const values = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  return values.every((value) => value >= 0 && value <= 255) ? values : undefined
}

function v4Class([a = 0, b = 0, c = 0, d = 0]: number[]): AddressClass {
  if (a === 0 && b === 0 && c === 0 && d === 0) return 'unspecified'
  if (a === 127) return 'loopback'
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private'
  if (a === 169 && b === 254) return 'private'
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat'
  return 'public'
}

function isV6(text: string): boolean {
  return text.includes(':') && /^[0-9a-f:.]+$/i.test(text)
}

/** The shape of an IP literal, or undefined when the text is not one. */
export function addressShape(host: string): AddressShape | undefined {
  const bare = host.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  const v4 = octets(bare)
  if (v4 !== undefined) return { family: 'v4', class: v4Class(v4) }
  if (!isV6(bare)) return undefined

  const lower = bare.toLowerCase()
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  const inner = mapped?.[1] === undefined ? undefined : octets(mapped[1])
  if (inner !== undefined) return { family: 'v6-mapped', class: v4Class(inner) }

  if (/^(?:0*:)*:?0*1$/.test(lower) && lower !== '1') return { family: 'v6', class: 'loopback' }
  if (/^[0:]+$/.test(lower)) return { family: 'v6', class: 'unspecified' }
  if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return { family: 'v6', class: 'private' }
  return { family: 'v6', class: 'public' }
}

/** `v4 public:22021`, or the class alone without a port. */
export function renderAddress(host: string, port?: number | string): string {
  const shape = addressShape(host)
  const head = shape === undefined ? 'host?' : `${shape.family} ${shape.class}`
  return port === undefined || port === '' ? head : `${head}:${String(port)}`
}
