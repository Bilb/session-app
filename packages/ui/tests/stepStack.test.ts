import { describe, expect, it } from 'vitest'

import { nextStack } from '#src/stepStack'

describe('the onboarding stack', () => {
  it('pushes a step moved forward to', () => {
    expect(nextStack(['landing'], 'loadAccount', 'forward')).toEqual(['landing', 'loadAccount'])
  })

  it('pops down to a step moved back to, however far', () => {
    const stack = ['landing', 'loadAccount', 'messageNotifications', 'loading']
    expect(nextStack(stack, 'landing', 'back')).toEqual(['landing'])
  })

  /** Giving up on a restore goes on to the name screen; going back from there is not a pop. */
  it('replaces the top when going back somewhere never pushed', () => {
    expect(nextStack(['landing', 'pickDisplayName'], 'loadAccount', 'back')).toEqual([
      'landing',
      'loadAccount',
    ])
  })

  it('lifts a step already below rather than holding it twice', () => {
    expect(
      nextStack(['landing', 'pickDisplayName', 'loading'], 'pickDisplayName', 'forward'),
    ).toEqual(['landing', 'loading', 'pickDisplayName'])
  })
})
