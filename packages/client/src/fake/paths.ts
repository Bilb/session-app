import type { NetworkPath, NetworkPaths, PathDestination } from '@session/bridge-types'

/**
 * The fake's paths: a handful shaped like Session Router's, with the countries real relays are in.
 *
 * What a caller can rely on, and what the fake keeps to:
 *
 *   - none at all until the network has connected, and none once it is gone;
 *   - four hops to a storage node, the last being the node, and three to the file server;
 *   - request totals that only grow, so two snapshots tell what went in between;
 *   - a ping answered along every path every five seconds, counted from when it was last built;
 *   - a path to the same remote keeps its remote when its hops change;
 *   - each remote has a standby path beside its current one, as the router keeps a spare, with
 *     no requests of its own but answering pings.
 *
 * The totals grow with the world's clock rather than with what the account does, because the
 * screen is about traffic over time and the fake sends nothing over a network. The countries are
 * weighted as the live network's are, mostly Germany, the United States and Finland.
 */

const ATTRIBUTION = 'IP Geolocation by DB-IP (https://db-ip.com)'

/** How often the router pings each path. */
const PING_EVERY_MS = 5_000

/** Countries in roughly the proportions the network's relays are in. */
const RELAY_COUNTRIES = ['DE', 'DE', 'DE', 'US', 'US', 'FI', 'FI', 'CA', 'NL', 'FR', 'GB', 'SG']

interface FakePathSpec {
  remoteHex: string
  destination: PathDestination
  /** How often a request goes along it, on the world's clock. */
  everyMs: number
  /** How often its hops are replaced. */
  rebuildMs: number
  proxied: boolean
}

function hex64(seed: number): string {
  return seed.toString(16).padStart(8, '0').repeat(8)
}

const SPECS: readonly FakePathSpec[] = [
  {
    remoteHex: hex64(0x51),
    destination: 'ownSwarm',
    everyMs: 5_000,
    rebuildMs: 600_000,
    proxied: false,
  },
  {
    remoteHex: hex64(0x52),
    destination: 'storageNode',
    everyMs: 7_000,
    rebuildMs: 480_000,
    proxied: false,
  },
  {
    remoteHex: hex64(0x53),
    destination: 'storageNode',
    everyMs: 11_000,
    rebuildMs: 540_000,
    proxied: false,
  },
  {
    remoteHex: hex64(0x54),
    destination: 'storageNode',
    everyMs: 23_000,
    rebuildMs: 420_000,
    proxied: true,
  },
  {
    remoteHex: hex64(0x55),
    destination: 'fileServer',
    everyMs: 41_000,
    rebuildMs: 720_000,
    proxied: false,
  },
]

function relay(seed: number): { pubkeyHex: string; country: string } {
  return {
    pubkeyHex: hex64(0x1000 + seed),
    country: RELAY_COUNTRIES[seed % RELAY_COUNTRIES.length] ?? 'DE',
  }
}

function pathOf(
  spec: FakePathSpec,
  index: number,
  elapsedMs: number,
  standby: boolean,
): NetworkPath {
  const build = Math.floor(elapsedMs / spec.rebuildMs)
  const base = index * 7 + build * 13 + (standby ? 3 : 0)
  const hopCount = spec.destination === 'fileServer' ? 3 : 4
  const hops = Array.from({ length: hopCount }, (_, k) => relay(base + k * 5))
  const requestsSent = standby ? 0 : Math.floor(elapsedMs / spec.everyMs)
  return {
    remoteHex: spec.remoteHex,
    destination: spec.destination,
    standby,
    hops,
    latencyMs: 180 + ((base * 37) % 260),
    jitterMs: 4 + ((base * 11) % 30),
    requestsSent,
    proxiedRequestsSent: spec.proxied ? requestsSent : 0,
    pingsAnswered: Math.floor((elapsedMs - build * spec.rebuildMs) / PING_EVERY_MS),
  }
}

/** The snapshot for a network connected `elapsedMs` ago, or none where `elapsedMs` is null. */
export function fakeNetworkPaths(elapsedMs: number | null): NetworkPaths {
  if (elapsedMs === null) return { paths: [], countryAttribution: ATTRIBUTION }
  return {
    paths: SPECS.flatMap((spec, index) => [
      pathOf(spec, index, elapsedMs, false),
      pathOf(spec, index, elapsedMs, true),
    ]),
    countryAttribution: ATTRIBUTION,
  }
}
