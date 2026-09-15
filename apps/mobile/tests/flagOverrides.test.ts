import { describe, expect, it } from 'vitest'

import { expectedVariables, flagOverride, overriddenVariables } from '#src/flagOverrides'

/**
 * The one thing a table of hand-written names can get wrong.
 *
 * Every variable has to be spelled out for Expo's transform to carry it into the bundle, which
 * means a flag added to the shared table can arrive with nothing on this side reading it -- and
 * the symptom is a variable that is simply ignored, on a device, with nothing said. This is the
 * check that turns that into a failure here.
 */
describe('the mobile flag overrides', () => {
  it('reads every variable the shared table defines', () => {
    expect(overriddenVariables().sort()).toEqual(expectedVariables().sort())
  })

  it('says nothing is set when a build carries no override', () => {
    expect(flagOverride('SESSION_FLAG_FORCE_FAST_MODE_AVAILABLE')).toBeNull()
  })

  it('has nothing to say about a name that is not a flag', () => {
    expect(flagOverride('SESSION_FLAG_NOT_A_FLAG')).toBeNull()
  })
})
