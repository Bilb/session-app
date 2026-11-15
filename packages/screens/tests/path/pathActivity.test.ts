import type { NetworkPath, NetworkPaths } from '@session/client'
import { describe, expect, it } from 'vitest'

import {
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
    ...over,
  }
}

function snap(...paths: NetworkPath[]): NetworkPaths {
  return { paths, countryAttribution: 'credit' }
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
    // A path that has carried traffic counts as in use; one that never has does not.
    expect(inUse(tracker, 1_000).map((p) => p.key)).toEqual(['a'])
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
    const { tracker } = trackSnapshot(
      EMPTY_TRACKER,
      snap(path({ remoteHex: 'a', requestsSent: 1 })),
      0,
      1_000,
    )
    expect(inUse(tracker, IN_USE_MS - 1)).toHaveLength(1)
    expect(inUse(tracker, IN_USE_MS)).toHaveLength(0)
  })
})

describe('pathStats', () => {
  it('summarises the paths in use, and entry nodes across every open path', () => {
    const { tracker } = trackSnapshot(
      EMPTY_TRACKER,
      snap(
        path({ remoteHex: 'a', requestsSent: 1, latencyMs: 200, jitterMs: 10 }),
        path({ remoteHex: 'b', requestsSent: 1, latencyMs: 400, jitterMs: 30 }),
        path({ remoteHex: 'idle', hops: [{ pubkeyHex: 'e9', country: 'SG' }] }),
      ),
      0,
      1_000,
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
    const { tracker } = trackSnapshot(
      EMPTY_TRACKER,
      snap(path({ remoteHex: 'a', requestsSent: 1, latencyMs: 0 })),
      0,
      1_000,
    )
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
