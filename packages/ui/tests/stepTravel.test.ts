import { describe, expect, it } from 'vitest'

import { stepTravel } from '#src/stepTravel'

/**
 * The arithmetic behind a push, which is the part that is wrong in a way no still frame shows.
 */
describe('how far the two screens of a push travel', () => {
  it('covers the old screen with the new one going forward', () => {
    const { enters, leaves } = stepTravel(400, 'forward')
    // The arriving screen crosses the whole width; the one behind it barely moves.
    expect(enters).toBe(400)
    expect(Math.abs(leaves)).toBeLessThan(Math.abs(enters))
    expect(leaves).toBeLessThan(0)
  })

  it('uncovers the old screen going back', () => {
    const { enters, leaves } = stepTravel(400, 'back')
    // The other way round: the screen being left crosses the width, and the one returned to is
    // already partly on screen.
    expect(leaves).toBe(400)
    expect(Math.abs(enters)).toBeLessThan(Math.abs(leaves))
    expect(enters).toBeLessThan(0)
  })

  it('is not a push with the signs flipped', () => {
    const forward = stepTravel(400, 'forward')
    const back = stepTravel(400, 'back')
    expect(back.enters).not.toBe(-forward.enters)
    expect(back.leaves).not.toBe(-forward.leaves)
  })

  it('has both screens at rest at zero width', () => {
    expect(stepTravel(0, 'forward')).toEqual({ enters: 0, leaves: -0 })
    expect(stepTravel(0, 'back')).toEqual({ enters: -0, leaves: 0 })
  })
})
