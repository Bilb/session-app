import { describe, expect, it } from 'vitest'

import { captureKey, missingPages, parseCompareArgs, UsageError } from '#catalog/options'

describe('the command line', () => {
  it('defaults to the merge base, the pr tier and Argos sensitivity', () => {
    expect(parseCompareArgs([])).toEqual({
      baseRef: undefined,
      tier: 'pr',
      sensitivity: 0.5,
      refresh: false,
      keepWorktree: false,
    })
  })

  it('takes a base ref and options in any order, and the -- pnpm may pass on', () => {
    expect(
      parseCompareArgs([
        '--',
        '--tier',
        'nightly',
        'origin/main~3',
        '--refresh',
        '--sensitivity',
        '0',
      ]),
    ).toMatchObject({ baseRef: 'origin/main~3', tier: 'nightly', sensitivity: 0, refresh: true })
  })

  it('refuses what it cannot act on', () => {
    expect(() => parseCompareArgs(['--tier', 'weekly'])).toThrow(UsageError)
    expect(() => parseCompareArgs(['--sensitivity', '2'])).toThrow(UsageError)
    expect(() => parseCompareArgs(['--colour'])).toThrow(UsageError)
    expect(() => parseCompareArgs(['a', 'b'])).toThrow(UsageError)
  })
})

describe('a cached capture', () => {
  const capture = { sha: 'abc', tier: 'pr', platform: 'darwin', arch: 'arm64' } as const

  it('is named by commit, tier and host', () => {
    expect(captureKey(capture)).toBe('abc-pr-darwin-arm64')
    expect(captureKey({ ...capture, tier: 'nightly' })).not.toBe(captureKey(capture))
  })

  it('is told apart when an older base was given the hidden-run change', () => {
    expect(captureKey({ ...capture, overlayHash: 'f00d' })).toBe('abc-pr-darwin-arm64-hidden-f00d')
  })
})

describe('a capture the spec did not finish', () => {
  it('names the pages it listed and never wrote, in its order', () => {
    expect(missingPages(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['b', 'd'])
    expect(missingPages(['a'], ['a', 'extra'])).toEqual([])
  })
})
