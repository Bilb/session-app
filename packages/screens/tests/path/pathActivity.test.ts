import type { NetworkPath, NetworkPaths } from '@session/client'
import { describe, expect, it } from 'vitest'

import {
  BUSY_REQUESTS,
  EMPTY_TRACKER,
  hopMsFor,
  IN_USE_MS,
  inUse,
  pathStats,
  trackSnapshot,
} from '#src/path/pathActivity'

function path(over: Partial<NetworkPath> & { remoteHex: string }): NetworkPath {
  return {
    destination: 'storageNode',
    hops: [
      { pubkeyHex: 'e1', country: 'DE' },
      { pubkeyHex: 'r1', country: 'US' },
      { pubkeyHex: 'r2', country: 'FI' },
      { pubkeyHex: 'd1', country: 'DE' },
    ],
    latencyMs: 300,
    jitterMs: 10,
    requestsSent: 0,
    proxiedRequestsSent: 0,
    pingsAnswered: 0,
    ...over,
  }
}

function snap(...paths: NetworkPath[]): NetworkPaths {
  return { paths, countryAttribution: 'credit' }
}

/**
 * `after` as the screen sees it at time 0, having opened on the same paths with nothing sent: the
 * requests it carries are seen, not taken as the baseline.
 */
function seen(after: NetworkPaths) {
  const idle = snap(...after.paths.map((p) => ({ ...p, requestsSent: 0, proxiedRequestsSent: 0 })))
  return trackSnapshot(trackSnapshot(EMPTY_TRACKER, idle, -1_000, 1_000).tracker, after, 0, 1_000)
}

describe('trackSnapshot', () => {
  it('takes the first snapshot as a baseline, not as requests seen', () => {
    const { tracker, requests } = trackSnapshot(
      EMPTY_TRACKER,
      snap(path({ remoteHex: 'a', requestsSent: 12 }), path({ remoteHex: 'b' })),
      1_000,
      1_000,
    )
    expect(requests).toEqual([])
    // Twelve requests at some time before: not a reason to draw the path now.
    expect(inUse(tracker, 1_000)).toEqual([])
  })

  it('sees the requests a total grew by, spread across the poll and capped as a burst', () => {
    const first = trackSnapshot(
      EMPTY_TRACKER,
      snap(path({ remoteHex: 'a', requestsSent: 1 })),
      0,
      1_000,
    )
    const two = trackSnapshot(
      first.tracker,
      snap(path({ remoteHex: 'a', requestsSent: 3 })),
      1_000,
      1_000,
    )
    expect(two.requests.map((r) => r.atMs)).toEqual([1_000, 1_500])
    const burst = trackSnapshot(
      two.tracker,
      snap(path({ remoteHex: 'a', requestsSent: 30 })),
      2_000,
      1_000,
    )
    expect(burst.requests).toHaveLength(4)
    expect(new Set([...two.requests, ...burst.requests].map((r) => r.id)).size).toBe(6)
  })

  it('counts a rebuild when a remote keeps its key but its hops change', () => {
    const first = trackSnapshot(EMPTY_TRACKER, snap(path({ remoteHex: 'a' })), 0, 1_000)
    const moved = path({ remoteHex: 'a', hops: [{ pubkeyHex: 'e2', country: 'NL' }] })
    expect(trackSnapshot(first.tracker, snap(moved), 1_000, 1_000).tracker.rebuilt).toBe(1)
  })

  it('names the file server as the last column and a proxying node as a community', () => {
    const { tracker } = trackSnapshot(
      EMPTY_TRACKER,
      snap(
        path({
          remoteHex: 'f',
          destination: 'fileServer',
          hops: path({ remoteHex: 'x' }).hops.slice(0, 3),
        }),
        path({ remoteHex: 'c', proxiedRequestsSent: 2, requestsSent: 2 }),
      ),
      0,
      1_000,
    )
    expect(tracker.paths.map((p) => [p.kind, p.countries])).toEqual([
      ['file', ['DE', 'US', 'FI', 'FS']],
      ['community', ['DE', 'US', 'FI', 'DE']],
    ])
  })

  it('stops counting a path as in use a minute after its last request', () => {
    const { tracker } = seen(snap(path({ remoteHex: 'a', requestsSent: 1 })))
    expect(inUse(tracker, IN_USE_MS - 1)).toHaveLength(1)
    expect(inUse(tracker, IN_USE_MS)).toHaveLength(0)
  })

  it('always counts the paths to your own swarm and the file server as in use', () => {
    const { tracker } = trackSnapshot(
      EMPTY_TRACKER,
      snap(
        path({ remoteHex: 'n' }),
        path({ remoteHex: 's', destination: 'ownSwarm' }),
        path({ remoteHex: 'f', destination: 'fileServer' }),
      ),
      0,
      1_000,
    )
    expect(inUse(tracker, IN_USE_MS * 10).map((p) => p.key)).toEqual(['s', 'f'])
  })
})

describe('pings', () => {
  const quiet = (over: Partial<NetworkPath> = {}) => path({ remoteHex: 'a', ...over })

  it('sees a ping when a path answers one, but not on the first look or after a rebuild', () => {
    const first = trackSnapshot(EMPTY_TRACKER, snap(quiet({ pingsAnswered: 7 })), 0, 1_000)
    expect(first.requests).toEqual([])
    const pinged = trackSnapshot(first.tracker, snap(quiet({ pingsAnswered: 8 })), 6_000, 1_000)
    expect(pinged.requests.map((r) => [r.kind, r.pathKey])).toEqual([['ping', 'a']])
    const moved = quiet({ pingsAnswered: 1, hops: [{ pubkeyHex: 'e2', country: 'NL' }] })
    expect(trackSnapshot(pinged.tracker, snap(moved), 12_000, 1_000).requests).toEqual([])
  })

  it('leaves out the pings on a path that has just carried a request', () => {
    const first = trackSnapshot(EMPTY_TRACKER, snap(quiet()), 0, 1_000)
    const both = trackSnapshot(
      first.tracker,
      snap(quiet({ requestsSent: 1, pingsAnswered: 1 })),
      1_000,
      1_000,
    )
    expect(both.requests.map((r) => r.kind)).toEqual(['request'])
  })

  it('leaves out every ping while the client is busy elsewhere', () => {
    const first = trackSnapshot(EMPTY_TRACKER, snap(quiet(), path({ remoteHex: 'b' })), 0, 1_000)
    const busy = trackSnapshot(
      first.tracker,
      snap(quiet({ pingsAnswered: 1 }), path({ remoteHex: 'b', requestsSent: BUSY_REQUESTS })),
      1_000,
      1_000,
    )
    expect(busy.requests.every((r) => r.kind === 'request')).toBe(true)
  })
})

describe('pathStats', () => {
  it('summarises the paths in use, and entry nodes across every open path', () => {
    const { tracker } = seen(
      snap(
        path({ remoteHex: 'a', requestsSent: 1, latencyMs: 200, jitterMs: 10 }),
        path({ remoteHex: 'b', requestsSent: 1, latencyMs: 400, jitterMs: 30 }),
        path({ remoteHex: 'idle', hops: [{ pubkeyHex: 'e9', country: 'SG' }] }),
      ),
    )
    expect(pathStats(tracker, 0)).toEqual({
      pathsInUse: 2,
      countriesCrossed: 3,
      entryNodes: 2,
      rebuilt: 0,
      averageMs: 300,
      fastestMs: 200,
      slowestMs: 400,
      jitterMs: 20,
    })
  })

  it('has no timings until a path in use has answered a ping', () => {
    const { tracker } = seen(snap(path({ remoteHex: 'a', requestsSent: 1, latencyMs: 0 })))
    expect(pathStats(tracker, 0).averageMs).toBeNull()
  })
})

describe('hopMsFor', () => {
  it('keeps a slower path slower, within a range that can be followed', () => {
    expect(hopMsFor(200)).toBeLessThan(hopMsFor(500))
    expect(hopMsFor(1)).toBe(140)
    expect(hopMsFor(5_000)).toBe(700)
  })
})
