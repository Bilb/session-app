import { describe, expect, it } from 'vitest'

import { hexToOklch, oklchToHex } from '#src/oklch'
import { deriveTokens, knobsFor } from '#src/themeTokens'

/**
 * What the colour boundary does with input it cannot read.
 *
 * Both cases below shipped, and the quiet one is the dangerous one: a five-digit hex produced a
 * *valid* colour rather than an obviously broken one, so a palette derived from it would have
 * looked deliberate. The loud one only looked safe because `baseFits` compares against NaN and
 * every such comparison is false -- nothing obliged a caller to ask it first.
 */
describe('a colour that cannot be parsed', () => {
  it('is refused rather than improvised, whatever shape the input is', () => {
    for (const bad of ['nonsense', '#12345', '#1234567', '', '#', '#ggg', '#12 45 67']) {
      expect(() => hexToOklch(bad), bad).toThrow(/Not a colour/)
    }
  })

  it('is refused at the public entry points too, not only deep inside', () => {
    // `knobsFor` and `deriveTokens` are what a picker would call.
    expect(() => knobsFor('#12345', '#31F196')).toThrow(/Not a colour/)
    expect(() => deriveTokens(knobsFor('#1B1B1B', '#31F196'), 'nonsense')).toThrow(/Not a colour/)
  })

  it('still takes the two shapes that are colours', () => {
    expect(oklchToHex(hexToOklch('#abc'))).toBe('#aabbcc')
    expect(oklchToHex(hexToOklch('#AABBCC'))).toBe('#aabbcc')
    expect(oklchToHex(hexToOklch('aabbcc'))).toBe('#aabbcc')
  })
})

/**
 * That the transform is the same one a browser applies.
 *
 * Implemented here rather than depended on, so the only thing standing between a wrong constant and
 * a wrong palette is a test. These four were read out of Chromium by painting each colour to a
 * canvas and sampling the pixel, including two that sRGB cannot hold -- the out-of-gamut cases are
 * the ones where an implementation is most likely to differ.
 */
describe('the sRGB transform', () => {
  it('agrees with Chromium, in and out of gamut', () => {
    const cases: [number, number, number, string][] = [
      [0.7, 0.16, 155, '#2bbb71'],
      [0.7, 0.4, 155, '#00d900'],
      [0.5, 0.35, 264, '#0000ff'],
      [0.85, 0.3, 110, '#ded800'],
    ]
    for (const [l, c, h, expected] of cases) {
      expect(oklchToHex({ l, c, h }), `oklch(${l} ${c} ${h})`).toBe(expected)
    }
  })

  it('round-trips a colour the gamut can hold', () => {
    const back = hexToOklch('#2bbb71')
    expect(oklchToHex(back)).toBe('#2bbb71')
    expect(back.h).toBeCloseTo(155, 0)
  })
})
