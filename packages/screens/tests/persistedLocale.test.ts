import { getLocale, followingSystemLocale, resetLocale, setLocale } from '@session/localization'
import { beforeEach, describe, expect, it } from 'vitest'

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
