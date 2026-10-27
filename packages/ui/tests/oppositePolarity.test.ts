import { describe, expect, it } from 'vitest'

import { oppositePolarity } from '#src/themes'

describe('the light/dark toggle', () => {
  it('keeps the family and flips the polarity', () => {
    expect(oppositePolarity('classic-dark')).toBe('classic-light')
    expect(oppositePolarity('classic-light')).toBe('classic-dark')
    expect(oppositePolarity('ocean-dark')).toBe('ocean-light')
    expect(oppositePolarity('ocean-light')).toBe('ocean-dark')
  })
})
