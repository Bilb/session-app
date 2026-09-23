import { followingSystemLocale, getLocale, resetLocale, setLocale } from '@session/localization'
import { beforeEach, describe, expect, it } from 'vitest'

import { localeToStoreFirst } from '#src/usePersistedLocale'

/**
 * What the stored value has to mean, which is the part a round trip can get wrong.
 *
 * The hook itself needs a store and a React tree; this covers the decision it encodes -- that
 * following the device is stored as itself rather than as the language it happens to resolve to
 * today. Writing the resolved locale would turn somebody who follows their device into somebody
 * who does not, silently, on their next launch.
 */
const SYSTEM = 'system'
const toStore = () => (followingSystemLocale() ? SYSTEM : getLocale())

describe('what a chosen language is stored as', () => {
  beforeEach(() => {
    resetLocale()
  })

  it('stores a chosen language by its own code', () => {
    setLocale('ar')
    expect(toStore()).toBe('ar')
  })

  it('stores following-the-device as itself, not as the language it resolves to', () => {
    // The trap: the device is English here, so a naive write would store `en` -- and the next
    // launch would read a chosen English rather than a device that happens to be English.
    expect(followingSystemLocale()).toBe(true)
    expect(toStore()).toBe(SYSTEM)
    expect(toStore()).not.toBe(getLocale())
  })

  it('tells a chosen language apart from the same one arrived at by following', () => {
    setLocale(getLocale())
    expect(followingSystemLocale()).toBe(false)
    expect(toStore()).not.toBe(SYSTEM)
  })
})

/**
 * The write that happens when the account first appears.
 *
 * Onboarding is the one stretch of the app where somebody picks a language and there is nowhere
 * to put it. The other write only fires on a *change*, and no change comes after onboarding ends
 * -- so without this one a language chosen there is shown for the rest of the session and gone on
 * the next launch.
 */
describe('the first write, once there is an account', () => {
  beforeEach(() => {
    resetLocale()
  })

  it('stores a language chosen before the account existed', () => {
    setLocale('ar')
    expect(localeToStoreFirst(undefined, followingSystemLocale(), getLocale())).toBe('ar')
  })

  it('stores nothing for somebody who never chose', () => {
    // Following the device is the default, so there is nothing to record and nothing that would
    // read differently on the next launch.
    expect(followingSystemLocale()).toBe(true)
    expect(localeToStoreFirst(undefined, followingSystemLocale(), getLocale())).toBeNull()
  })

  it('leaves a stored value alone', () => {
    setLocale('ar')
    expect(localeToStoreFirst('fr', followingSystemLocale(), getLocale())).toBeNull()
    expect(localeToStoreFirst(SYSTEM, followingSystemLocale(), getLocale())).toBeNull()
  })
})
