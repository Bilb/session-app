import { describe, expect, it } from 'vitest'

import { rampSizeAtMost } from '#src/rampSize'

describe('rampSizeAtMost', () => {
  it('lands the avatars in use on their rungs', () => {
    // 40 wide: two letters at 0.4, one at 0.5. 90 wide, the settings avatar: two at 0.4.
    expect(rampSizeAtMost(16)).toBe('bodyLarge')
    expect(rampSizeAtMost(20)).toBe('titleLarge')
    expect(rampSizeAtMost(36)).toBe('displayLarge')
  })

  it('takes the rung below a size between two, and the top rung past the ramp', () => {
    expect(rampSizeAtMost(17)).toBe('bodyLarge')
    expect(rampSizeAtMost(45)).toBe('displayLarge')
  })

  it('never goes below the smallest rung', () => {
    expect(rampSizeAtMost(4)).toBe('caption')
  })
})
