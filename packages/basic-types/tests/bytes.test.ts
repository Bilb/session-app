import { describe, expect, it } from 'vitest'

import { formatBytes, roughBytes } from '#src/bytes'

describe('formatBytes', () => {
  it('uses decimal units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1_234)).toBe('1.2 kB')
    expect(formatBytes(48_200_000)).toBe('48.2 MB')
    expect(formatBytes(312_000_000)).toBe('312 MB')
  })

  it('steps to the next unit when rounding reaches it', () => {
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(999_499)).toBe('999 kB')
    expect(formatBytes(999_999)).toBe('1.0 MB')
    expect(formatBytes(999_500_000)).toBe('1.0 GB')
  })

  it('drops the decimal once rounding reaches a hundred', () => {
    expect(formatBytes(9_960)).toBe('10.0 kB')
    expect(formatBytes(99_940)).toBe('99.9 kB')
    expect(formatBytes(99_960)).toBe('100 kB')
  })

  it('says nothing for what is not a size', () => {
    expect(formatBytes(-1)).toBe('')
    expect(formatBytes(Number.NaN)).toBe('')
  })
})

describe('roughBytes', () => {
  it('keeps two significant figures from a kilobyte up, and a smaller count exact', () => {
    expect(roughBytes(48_234_496)).toBe('48 MB')
    expect(roughBytes(1_234)).toBe('1.2 kB')
    expect(roughBytes(312_400_000)).toBe('310 MB')
    expect(roughBytes(41_234_000_000)).toBe('41 GB')
    expect(roughBytes(512)).toBe('512 B')
  })

  it('steps to the next unit when rounding reaches it', () => {
    expect(roughBytes(999)).toBe('999 B')
    expect(roughBytes(994_999)).toBe('990 kB')
    expect(roughBytes(999_999)).toBe('1.0 MB')
    expect(roughBytes(999_500_000)).toBe('1.0 GB')
  })

  it('drops the decimal at each decade', () => {
    expect(roughBytes(1_000)).toBe('1.0 kB')
    expect(roughBytes(9_940)).toBe('9.9 kB')
    expect(roughBytes(9_960)).toBe('10 kB')
    expect(roughBytes(10_000)).toBe('10 kB')
    expect(roughBytes(99_499)).toBe('99 kB')
    expect(roughBytes(99_500)).toBe('100 kB')
    expect(roughBytes(100_000)).toBe('100 kB')
  })
})
