import { describe, expect, it } from 'vitest'

import { shadowWithAlpha } from '#src/shadowColour'

describe("a shadow colour's alpha", () => {
  it('is changed and the colour kept', () => {
    expect(shadowWithAlpha('rgba(0, 0, 0, 1)', (a) => Math.min(a, 0.51))).toBe(
      'rgba(0, 0, 0, 0.51)',
    )
    expect(shadowWithAlpha('rgba(10, 20, 30, 0.25)', (a) => Math.min(a, 0.51))).toBe(
      'rgba(10, 20, 30, 0.25)',
    )
  })

  it('treats anything but rgba() as opaque black', () => {
    expect(shadowWithAlpha('#000', (a) => a / 2)).toBe('rgba(0, 0, 0, 0.5)')
  })
})
