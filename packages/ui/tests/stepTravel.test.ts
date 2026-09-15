import { describe, expect, it } from 'vitest'

import { stepTravel } from '#src/stepTravel'

/**
 * The arithmetic behind a push, which is the part that is wrong in a way no still frame shows: a
 * sign flipped here makes back and forward look the same, and both look plausible.
 */
describe('how far the two screens of a push travel', () => {
  it('brings a new step in from the trailing edge and sends the old one the other way', () => {
    const { enters, leaves } = stepTravel(400, 'forward')
    expect(enters).toBe(400)
    expect(leaves).toBeLessThan(0)
  })

  it('mirrors both of them going back', () => {
    const forward = stepTravel(400, 'forward')
    const back = stepTravel(400, 'back')
    expect(back.enters).toBe(-forward.enters)
    expect(back.leaves).toBe(-forward.leaves)
  })

  it('moves the departing screen a fraction of what the arriving one covers', () => {
    const { enters, leaves } = stepTravel(400, 'forward')
    expect(Math.abs(leaves)).toBeLessThan(Math.abs(enters))
  })
})
