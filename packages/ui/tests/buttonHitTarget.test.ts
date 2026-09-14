import { describe, expect, it } from 'vitest'

import { MIN_HIT_TARGET, hitSlopFor } from '#src/buttonHitTarget'

describe('a small button’s touch target', () => {
  it('reaches the floor however small the control is drawn', () => {
    // `xs` is an icon button drawn at the size of its glyph -- 24 tall, which is the right look and
    // a target barely half what a thumb needs. Both onboarding's back and language buttons are one.
    expect(24 + hitSlopFor('xs') * 2).toBe(MIN_HIT_TARGET)
    expect(32 + hitSlopFor('sm') * 2).toBe(MIN_HIT_TARGET)
  })

  it('adds nothing to a control that is already big enough', () => {
    expect(hitSlopFor('md')).toBe(0)
    expect(hitSlopFor('lg')).toBe(0)
  })
})
