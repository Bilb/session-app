import { describe, expect, it } from 'vitest'

import {
  asksAboutNotifications,
  backNeedsConfirming,
  isWideDesign,
  initialOnboarding,
  onboardingReducer,
  type OnboardingDesign,
  type OnboardingEvent,
  type OnboardingState,
} from '#src/onboarding/flow'

/**
 * The sequences, as the legacy clients run them. Ported rather than designed, so the tests that
 * matter pin what a redesign would quietly get wrong: when the account is made, when notifications
 * are asked about, where a failed restore lands -- and that the two designs are different flows
 * rather than one flow laid out two ways.
 */
function run(events: OnboardingEvent[], design: OnboardingDesign = 'phone'): OnboardingState {
  return events.reduce(onboardingReducer, initialOnboarding(design))
}

const NAME: OnboardingEvent = { type: 'nameEntered', name: 'Ada' }
const PHRASE: OnboardingEvent = { type: 'phraseEntered', from: { words: ['one', 'two'] } }
const FAST: OnboardingEvent = { type: 'notificationsChosen', mode: 'fast' }
const CREATE: OnboardingEvent = { type: 'chooseCreate' }
const RESTORE: OnboardingEvent = { type: 'chooseRestore' }

describe('the phone sequences', () => {
  it('creates: landing, name, notifications, done', () => {
    expect(run([CREATE]).step).toBe('pickDisplayName')
    expect(run([CREATE, NAME]).step).toBe('messageNotifications')
    expect(run([CREATE, NAME, FAST]).step).toBe('done')
  })

  it('restores: landing, phrase, notifications, loading', () => {
    expect(run([RESTORE]).step).toBe('loadAccount')
    expect(run([RESTORE, PHRASE]).step).toBe('messageNotifications')
    expect(run([RESTORE, PHRASE, FAST]).step).toBe('loading')
  })

  it('asks about notifications before the wait, not after', () => {
    // Restoring can take fifteen seconds. Asking afterwards means fifteen seconds of nothing and
    // then a question, which is the order this test exists to prevent.
    const state = run([RESTORE, PHRASE])
    expect(state.step).toBe('messageNotifications')
    expect(state.notifications).toBeNull()
  })
})

describe('the desktop sequences', () => {
  it('never asks about notification mode', () => {
    // Fast mode is a push service and desktop has none, so the question has no answer worth
    // asking for. A different flow, not the phone flow in a wider column.
    expect(run([CREATE, NAME], 'desktop').step).toBe('done')
    expect(run([RESTORE, PHRASE], 'desktop').step).toBe('loading')
  })

  it('never records a notification mode either', () => {
    expect(run([CREATE, NAME], 'desktop').notifications).toBeNull()
  })
})

describe('what the create branch does with the name', () => {
  it('holds it rather than applying it, because there is no account yet', () => {
    // The account is minted at the end of create. A name applied at the name step would be a name
    // applied to nothing, and backing out would leave a half-made account behind.
    const held = run([CREATE, NAME])
    expect(held.displayName).toBe('Ada')
    expect(held.step).toBe('messageNotifications')
  })
})

describe('a restore that gives up', () => {
  const gaveUp = run([RESTORE, PHRASE, FAST, { type: 'restoreGaveUp' }])

  it('lands in the name picker, not back at the phrase', () => {
    // The phrase decoded -- the profile simply never arrived. There is nothing to retype, and
    // sending someone back to the phrase field says there is.
    expect(gaveUp.step).toBe('pickDisplayName')
    expect(gaveUp.afterFailedRestore).toBe(true)
  })

  it('finishes at the name, because the account already exists', () => {
    expect(onboardingReducer(gaveUp, NAME).step).toBe('done')
  })

  it('does the same on the desktop design', () => {
    const desktop = run([RESTORE, PHRASE, { type: 'restoreGaveUp' }], 'desktop')
    expect(desktop.step).toBe('pickDisplayName')
    expect(onboardingReducer(desktop, NAME).step).toBe('done')
  })
})

describe('going back', () => {
  it('returns to the landing screen from either branch’s first step', () => {
    expect(run([CREATE, { type: 'back' }]).step).toBe('landing')
    expect(run([RESTORE, { type: 'back' }]).step).toBe('landing')
  })

  it('returns to whichever step led to notifications', () => {
    expect(run([CREATE, NAME, { type: 'back' }]).step).toBe('pickDisplayName')
    expect(run([RESTORE, PHRASE, { type: 'back' }]).step).toBe('loadAccount')
  })

  it('does nothing at the landing screen', () => {
    expect(run([{ type: 'back' }])).toEqual(initialOnboarding('phone'))
  })

  it('does nothing once an account exists', () => {
    // Backing out of naming a restored account would leave it nameless rather than undo anything.
    const gaveUp = run([RESTORE, PHRASE, FAST, { type: 'restoreGaveUp' }])
    expect(onboardingReducer(gaveUp, { type: 'back' }).step).toBe('pickDisplayName')
    // And on desktop, where `loading` is reached straight from the phrase.
    expect(onboardingReducer(run([RESTORE, PHRASE], 'desktop'), { type: 'back' }).step).toBe(
      'loading',
    )
  })

  it('asks only where an account has really been taken over', () => {
    // The one step where going back would have to delete somebody's actual account, rather than
    // discard something half-made: the restore succeeded and only its name never arrived.
    expect(backNeedsConfirming(run([RESTORE, PHRASE, FAST, { type: 'restoreGaveUp' }]))).toBe(true)

    // Everywhere else nothing exists yet to abandon. Creating holds the name and mints at the end;
    // restoring checks the phrase and mints at the wait.
    expect(backNeedsConfirming(run([CREATE]))).toBe(false)
    expect(backNeedsConfirming(run([RESTORE]))).toBe(false)
    expect(backNeedsConfirming(run([RESTORE, PHRASE]))).toBe(false)
    expect(backNeedsConfirming(initialOnboarding('phone'))).toBe(false)
  })
})

describe('the window changing width mid-flow', () => {
  it('switches which sequence the remaining steps follow', () => {
    // A tablet rotated, or a desktop window dragged narrow. The design follows the width, so what
    // comes next follows it too, rather than finishing in a shape the window no longer is.
    const rotated = run([CREATE, { type: 'designChanged', design: 'desktop' }])
    expect(onboardingReducer(rotated, NAME).step).toBe('done')
  })

  it('leaves everything already collected alone', () => {
    const rotated = run([CREATE, NAME, { type: 'designChanged', design: 'desktop' }])
    expect(rotated.displayName).toBe('Ada')
    expect(rotated.step).toBe('messageNotifications')
  })
})

describe('changing branch', () => {
  it('clears the failed-restore copy if the landing screen is reached again', () => {
    // Otherwise the create branch inherits "your account could not be restored" from a previous
    // attempt, which is both wrong and alarming.
    const again = run([RESTORE, PHRASE, FAST, { type: 'restoreGaveUp' }, CREATE])
    expect(again.afterFailedRestore).toBe(false)
  })
})

describe('a bridge that refuses the last step', () => {
  const FAILED: OnboardingEvent = { type: 'commitFailed' }

  it('goes back to the name picker rather than staying on a step that draws nothing', () => {
    // `done` renders null, so a rejection left there is an empty window: no message, no way on,
    // and nothing to press. Found by running the flow against real libsession.
    const stuck = run([CREATE, NAME, FAST, FAILED])
    expect(stuck.step).toBe('pickDisplayName')
    expect(stuck.commitFailed).toBe(true)
  })

  it('keeps the name that was typed, so it does not have to be typed again', () => {
    expect(run([CREATE, NAME, FAST, FAILED]).displayName).toBe('Ada')
  })

  it('does the same on the desktop design, where done follows the name directly', () => {
    expect(run([CREATE, NAME, FAILED], 'desktop').step).toBe('pickDisplayName')
  })

  it('lands there after a restore that had to ask for a name too', () => {
    const failed = run([RESTORE, PHRASE, FAST, { type: 'restoreGaveUp' }, NAME, FAILED])
    expect(failed.step).toBe('pickDisplayName')
    // Still the restore branch's copy: what failed was naming the account, not restoring it.
    expect(failed.afterFailedRestore).toBe(true)
  })

  it('clears the refusal when the name is submitted again', () => {
    expect(run([CREATE, NAME, FAST, FAILED, NAME]).commitFailed).toBe(false)
  })
})

describe('the wait for a restored profile', () => {
  it('ends as soon as the name arrives, rather than always running out', () => {
    // The timeout used to be the only way out, so a swarm that answered in two seconds still cost
    // fifteen and then asked somebody to rename themselves.
    expect(run([RESTORE, PHRASE, FAST, { type: 'restoreArrived' }]).step).toBe('done')
  })

  it('goes back to the phrase if libsession will not take the account over', () => {
    // Not a typo - the phrase decoded a moment earlier - but that screen owns the field, so it is
    // the only one that can be tried again.
    expect(run([RESTORE, PHRASE, FAST, { type: 'restoreFailed' }]).step).toBe('loadAccount')
  })

  it('still holds the phrase, so going back does not mean retyping it', () => {
    expect(run([RESTORE, PHRASE, FAST, { type: 'restoreFailed' }]).recovery).toEqual({
      words: ['one', 'two'],
    })
  })
})

describe('the tablet sequences', () => {
  // The desktop layout with the phone's notification step. The two are separate questions: the
  // width decides the frame, and whether the OS suspends the app decides whether there is a
  // delivery mode to choose at all.
  it('creates: landing, name, notifications, done - the phone sequence', () => {
    expect(run([CREATE], 'tablet').step).toBe('pickDisplayName')
    expect(run([CREATE, NAME], 'tablet').step).toBe('messageNotifications')
    expect(run([CREATE, NAME, FAST], 'tablet').step).toBe('done')
  })

  it('restores: landing, phrase, notifications, loading', () => {
    expect(run([RESTORE, PHRASE], 'tablet').step).toBe('messageNotifications')
    expect(run([RESTORE, PHRASE, FAST], 'tablet').step).toBe('loading')
  })

  it('asks about notifications, where the desktop design does not', () => {
    expect(asksAboutNotifications('tablet')).toBe(true)
    expect(asksAboutNotifications('phone')).toBe(true)
    expect(asksAboutNotifications('desktop')).toBe(false)
  })

  it('draws the wide frame, where the phone design does not', () => {
    expect(isWideDesign('tablet')).toBe(true)
    expect(isWideDesign('desktop')).toBe(true)
    expect(isWideDesign('phone')).toBe(false)
  })
})
