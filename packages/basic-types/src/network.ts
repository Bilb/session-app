/**
 * Which Session network a build talks to.
 *
 * Here rather than beside the ports it is read through, because three programs need it and one of
 * them is Electron's main process, which has no business importing a package full of React.
 */
export type NetworkName = 'mainnet' | 'testnet' | 'devnet'

/**
 * Reads `SESSION_NETID` into a network name, for whoever is doing the reading.
 *
 * One function because every app has two readers and they must not diverge: the transport, which
 * decides what libsession attaches to, and the overlay, which tells a person what that was. They
 * used to be two expressions, and the older one turned anything it did not recognise into mainnet
 * - so `SESSION_NETID=devnet` attached to mainnet while asking for a devnet. Stamping that build
 * `devnet` would have been worse than not stamping it at all: it says "this is not real" over an
 * app that is talking to real people.
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
 * devnet is deliberately not a `NetId`: libsession needs seed node details to reach one, the shim
 * refuses it, and offering it here would be offering something that always throws
 * (see @session/bridge-types and docs/STATUS.md).
 *
 * So a devnet build attaches **nothing at all**. Not mainnet - that is the outcome worth ruling
 * out, because it is real traffic from a build whose owner believes it is a sandbox, and the
 * overlay saying `devnet` over it would make that belief look confirmed. Nothing attaches, the
 * settings screen says so, and the stamp is telling the truth.
 */
export function netidForTransport(name: NetworkName): 'mainnet' | 'testnet' | undefined {
  return name === 'devnet' ? undefined : name
}
