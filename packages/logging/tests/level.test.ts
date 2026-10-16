import { describe, expect, it } from 'vitest'

import { minLevelFromSpec } from '#src/level'

describe('minLevelFromSpec', () => {
  it('keeps info and above of every category when there is no spec', () => {
    for (const spec of [undefined, '', ' , ']) {
      const minLevel = minLevelFromSpec(spec)
      expect(minLevel('session')).toBe('info')
      expect(minLevel('network')).toBe('info')
    }
  })

  it("keeps a category at its own pair's level, and the rest at the bare level", () => {
    const minLevel = minLevelFromSpec('debug,network=trace')
    expect(minLevel('network')).toBe('trace')
    expect(minLevel('quic')).toBe('debug')
    expect(minLevel('session')).toBe('debug')
  })

  it('only ever adds detail: a quieter level than info keeps info', () => {
    const minLevel = minLevelFromSpec('warn,network=debug,quic=error')
    expect(minLevel('network')).toBe('debug')
    expect(minLevel('quic')).toBe('info')
    expect(minLevel('session')).toBe('info')
  })

  it('treats the app categories like any other', () => {
    expect(minLevelFromSpec('session=debug')('session')).toBe('debug')
    expect(minLevelFromSpec('session=debug')('attach')).toBe('info')
  })
})
