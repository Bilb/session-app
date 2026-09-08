/**
 * Which Session network a build talks to.
 *
 * Here rather than beside the ports it is read through, because one of its three readers is
 * Electron's main process, which cannot import a package that pulls in React.
 */
export type NetworkName = 'mainnet' | 'testnet' | 'devnet'

/**
 * Reads `SESSION_NETID` into a network name, for whoever is doing the reading.
 *
 * One function because every app has two readers that must not diverge: the transport, which
 * decides what libsession attaches to, and the overlay, which tells a person what that was. Parse
 * the variable twice and a build can attach to one network while the stamp names another.
 *
 * An unrecognised value is mainnet, because unset has to be and there is nothing better to do with
 * a typo. `devnet` is returned as itself and the caller decides - see `netidForTransport`.
 */
export function parseNetworkName(value: string | undefined): NetworkName {
  return value === 'testnet' || value === 'devnet' ? value : 'mainnet'
}

/**
 * What to hand the transport, or nothing.
 *
 * devnet is deliberately not a `NetId`: libsession needs seed node details to reach one and the
 * shim refuses it, so offering it here would offer something that always throws (see
 * @session/bridge-types and docs/STATUS.md).
 *
 * A devnet build therefore attaches nothing at all. Never mainnet: falling back to it would put
 * real traffic on a build whose owner believes it is a sandbox, and the overlay stamping `devnet`
 * over that would confirm the belief rather than contradict it.
 */
export function netidForTransport(name: NetworkName): 'mainnet' | 'testnet' | undefined {
  return name === 'devnet' ? undefined : name
}
