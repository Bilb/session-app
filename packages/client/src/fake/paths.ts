import type { NetworkPath, NetworkPaths, PathDestination } from '@session/bridge-types'

/**
 * The fake's paths: a handful shaped like Session Router's, with the countries real relays are in.
 *
 * What a caller can rely on, and what the fake keeps to:
 *
 *   - none at all until the network has connected, and none once it is gone;
 *   - four hops to a storage node, the last being the node, and three to the file server;
 *   - every path's first hop one of four entry nodes, as the router keeps;
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

/** The router's entry nodes: a client keeps four and builds every path from one of them. */
const ENTRY_NODES = 4

/** A path's hops: an entry node, then relays, the last being the destination where it is one. */
function hopsFor(base: number, count: number): { pubkeyHex: string; country: string }[] {
  return Array.from({ length: count }, (_, k) =>
    k === 0 ? relay(0x900 + (base % ENTRY_NODES)) : relay(base + k * 5),
  )
}

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
  const hops = hopsFor(base, hopCount)
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

/**
 * How much the fake's account does: `quiet` is a new account's handful of paths; `busy` is an
 * account in 36 groups and two communities, as a legacy client's log of one has it, estimated for
 * Session Router.
 */
export type FakePathTraffic = 'quiet' | 'busy'

export const FAKE_PATH_TRAFFIC: readonly FakePathTraffic[] = ['quiet', 'busy']

/**
 * The busy account, from a legacy iOS client's log (November 2026) of an account in 36 groups and
 * two communities, with what Session Router changes:
 *
 *   - your swarm and each group's are subscribed to, so each sees one request every 30 seconds,
 *     the subscription's probe, where the legacy client polled every 2 seconds and every 30;
 *   - a community has no subscription, so it is still polled, every 5 and every 11 seconds as in
 *     the log, and each poll goes through a node no other request is using: a new session, with
 *     paths of its own, every time;
 *   - the file server now and then, for a display picture or an attachment.
 */
const BUSY_GROUPS = 36
const PROBE_EVERY_MS = 30_000
const COMMUNITY_POLL_MS = [5_000, 11_000] as const
const FILE_EVERY_MS = 45_000
/** How long a community's one-request session stays open after its request. */
const PROXY_LINGER_MS = 75_000

const BUSY_SPECS: readonly FakePathSpec[] = [
  { remoteHex: hex64(0x51), destination: 'ownSwarm', everyMs: PROBE_EVERY_MS, rebuildMs: 600_000, proxied: false },
  { remoteHex: hex64(0x55), destination: 'fileServer', everyMs: FILE_EVERY_MS, rebuildMs: 720_000, proxied: false },
  ...Array.from({ length: BUSY_GROUPS }, (_, i): FakePathSpec => ({
    remoteHex: hex64(0x2000 + i),
    destination: 'storageNode',
    everyMs: PROBE_EVERY_MS,
    rebuildMs: 420_000 + i * 9_000,
    proxied: false,
  })),
] // prettier-ignore

/** Its two paths, for a spec whose requests are spread through the period by its place in line. */
function busyPair(spec: FakePathSpec, index: number, elapsedMs: number): NetworkPath[] {
  // Staggered, as the legacy client's pollers were: not every group probed in the same second.
  const phase = (index * spec.everyMs) / (BUSY_GROUPS + 2)
  return [false, true].map((standby) => {
    const path = pathOf(spec, index, elapsedMs, standby)
    return standby
      ? path
      : { ...path, requestsSent: Math.floor((elapsedMs + phase) / spec.everyMs) }
  })
}

/** A community poll's session: one request through a fresh node, and its spare. */
function proxySessions(elapsedMs: number): NetworkPath[] {
  const out: NetworkPath[] = []
  COMMUNITY_POLL_MS.forEach((everyMs, community) => {
    const last = Math.floor(elapsedMs / everyMs)
    const first = Math.max(0, Math.ceil((elapsedMs - PROXY_LINGER_MS) / everyMs))
    for (let poll = first; poll <= last; poll += 1) {
      const openedMs = poll * everyMs
      const seed = 0x3000 + community * 0x800 + (poll % 0x800)
      for (const standby of [false, true]) {
        const base = seed * 5 + (standby ? 3 : 0)
        out.push({
          remoteHex: hex64(seed),
          destination: 'storageNode',
          standby,
          hops: hopsFor(base, 4),
          latencyMs: 180 + ((base * 37) % 260),
          jitterMs: 4 + ((base * 11) % 30),
          requestsSent: standby ? 0 : 1,
          proxiedRequestsSent: standby ? 0 : 1,
          pingsAnswered: Math.floor((elapsedMs - openedMs) / PING_EVERY_MS),
        })
      }
    }
  })
  return out
}

/** The snapshot for a network connected `elapsedMs` ago, or none where `elapsedMs` is null. */
export function fakeNetworkPaths(
  elapsedMs: number | null,
  traffic: FakePathTraffic = 'quiet',
): NetworkPaths {
  if (elapsedMs === null) return { paths: [], countryAttribution: ATTRIBUTION }
  if (traffic === 'busy') {
    return {
      paths: [
        ...BUSY_SPECS.flatMap((spec, index) => busyPair(spec, index, elapsedMs)),
        ...proxySessions(elapsedMs),
      ],
      countryAttribution: ATTRIBUTION,
    }
  }
  return {
    paths: SPECS.flatMap((spec, index) => [
      pathOf(spec, index, elapsedMs, false),
      pathOf(spec, index, elapsedMs, true),
    ]),
    countryAttribution: ATTRIBUTION,
  }
}
