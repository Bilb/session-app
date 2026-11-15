import type { NetworkPath, NetworkPaths } from '@session/client'

/**
 * What the path screen makes of the snapshots it polls: which paths are in use, which requests
 * set off since the last look, how often paths were rebuilt, and the figures in its stats.
 *
 * libsession reports totals rather than events, so a request is "seen" when a path's total goes
 * up between two snapshots. When is known to within one poll, which is why the requests found in
 * one are spread across the interval rather than all starting together.
 */

/** A path counts as in use for this long after its last request. */
export const IN_USE_MS = 60_000

/** More than this many requests in one poll are drawn as this many: a burst, not a queue. */
const MAX_PER_POLL = 4

export type PathKind = 'swarm' | 'node' | 'community' | 'file'

export interface TrackedPath {
  key: string
  kind: PathKind
  /** A country per column after "you": entry, relay, relay, destination (`FS` the file server). */
  countries: (string | null)[]
  entryHex: string | null
  latencyMs: number
  jitterMs: number
  /** When it last carried a request, or null if not since the screen opened. */
  lastRequestAtMs: number | null
}

export interface SeenRequest {
  id: string
  pathKey: string
  atMs: number
}

export interface PathTracker {
  paths: TrackedPath[]
  totals: ReadonlyMap<string, number>
  hopSignatures: ReadonlyMap<string, string>
  rebuilt: number
  attribution: string
  /** How many requests have been seen, for ids. */
  seq: number
}

export const EMPTY_TRACKER: PathTracker = {
  paths: [],
  totals: new Map(),
  hopSignatures: new Map(),
  rebuilt: 0,
  attribution: '',
  seq: 0,
}

function kindOf(path: NetworkPath): PathKind {
  if (path.destination === 'fileServer') return 'file'
  if (path.destination === 'ownSwarm') return 'swarm'
  // A node a community request went through: it proxies to the server, which is what it is for.
  return path.proxiedRequestsSent > 0 ? 'community' : 'node'
}

function countriesOf(path: NetworkPath): (string | null)[] {
  const hops = path.hops.map((hop) => hop.country ?? null)
  // The file server lies past the last relay we can see; its column is the server itself.
  return path.destination === 'fileServer' ? [...hops.slice(0, 3), 'FS'] : hops.slice(0, 4)
}

/**
 * Folds one snapshot into the tracker. The first snapshot sets the baseline: totals from before
 * the screen opened are not requests it saw, but a path that has carried any counts as in use.
 */
export function trackSnapshot(
  tracker: PathTracker,
  snapshot: NetworkPaths,
  nowMs: number,
  pollMs: number,
): { tracker: PathTracker; requests: SeenRequest[] } {
  const first = tracker.totals.size === 0 && tracker.paths.length === 0
  const previous = new Map(tracker.paths.map((p) => [p.key, p]))
  const totals = new Map<string, number>()
  const hopSignatures = new Map<string, string>()
  const requests: SeenRequest[] = []
  let rebuilt = tracker.rebuilt
  let seq = tracker.seq

  const paths = snapshot.paths.map((path): TrackedPath => {
    const key = path.remoteHex
    const signature = path.hops.map((hop) => hop.pubkeyHex).join(',')
    const before = tracker.hopSignatures.get(key)
    if (before !== undefined && before !== signature) rebuilt += 1
    hopSignatures.set(key, signature)

    totals.set(key, path.requestsSent)
    const was = tracker.totals.get(key)
    let lastRequestAtMs = previous.get(key)?.lastRequestAtMs ?? null
    if (first) {
      if (path.requestsSent > 0) lastRequestAtMs = nowMs
    } else {
      const added = path.requestsSent - (was ?? 0)
      if (added > 0) {
        const shown = Math.min(added, MAX_PER_POLL)
        for (let i = 0; i < shown; i += 1) {
          seq += 1
          requests.push({ id: `r${seq}`, pathKey: key, atMs: nowMs + (pollMs * i) / shown })
        }
        lastRequestAtMs = nowMs
      }
    }

    return {
      key,
      kind: kindOf(path),
      countries: countriesOf(path),
      entryHex: path.hops[0]?.pubkeyHex ?? null,
      latencyMs: path.latencyMs,
      jitterMs: path.jitterMs,
      lastRequestAtMs,
    }
  })

  return {
    tracker: {
      paths,
      totals,
      hopSignatures,
      rebuilt,
      attribution: snapshot.countryAttribution,
      seq,
    },
    requests,
  }
}

export function inUse(tracker: PathTracker, nowMs: number): TrackedPath[] {
  return tracker.paths.filter(
    (p) => p.lastRequestAtMs !== null && nowMs - p.lastRequestAtMs < IN_USE_MS,
  )
}

export interface PathStats {
  pathsInUse: number
  countriesCrossed: number
  entryNodes: number
  rebuilt: number
  /** Null until some path in use has answered a ping. */
  averageMs: number | null
  fastestMs: number | null
  slowestMs: number | null
  jitterMs: number | null
}

export function pathStats(tracker: PathTracker, nowMs: number): PathStats {
  const used = inUse(tracker, nowMs)
  const countries = new Set<string>()
  for (const p of used)
    for (const cc of p.countries) if (cc !== null && cc !== 'FS') countries.add(cc)
  // Entry nodes across every open path: they are shared, at most four per client.
  const entries = new Set(tracker.paths.map((p) => p.entryHex).filter((e) => e !== null))
  const timed = used.filter((p) => p.latencyMs > 0)
  const latencies = timed.map((p) => p.latencyMs)
  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    pathsInUse: used.length,
    countriesCrossed: countries.size,
    entryNodes: entries.size,
    rebuilt: tracker.rebuilt,
    averageMs: mean(latencies),
    fastestMs: latencies.length === 0 ? null : Math.min(...latencies),
    slowestMs: latencies.length === 0 ? null : Math.max(...latencies),
    jitterMs: mean(timed.map((p) => p.jitterMs)),
  }
}

/**
 * How long one link takes on screen, from the path's measured round trip: real round trips are
 * 150-600 ms, too quick to follow, so they are slowed by a fixed factor that keeps a slow path
 * visibly slower than a fast one, and clamped so neither is a blur nor a crawl.
 */
export const SLOWDOWN = 6
const MIN_HOP_MS = 140
const MAX_HOP_MS = 700
const UNTIMED_HOP_MS = 320

export function hopMsFor(latencyMs: number): number {
  if (latencyMs <= 0) return UNTIMED_HOP_MS
  // A round trip crosses each of the four links twice.
  return Math.min(MAX_HOP_MS, Math.max(MIN_HOP_MS, (latencyMs * SLOWDOWN) / 8))
}
