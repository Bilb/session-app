import { describe, expect, it } from 'vitest'

import { avatarInitials } from '#src/avatarInitials'

const ID = `05${'ab'.repeat(32)}`

describe('avatarInitials', () => {
  it('gives a one-word name its first two characters', () => {
    expect(avatarInitials('alice', ID)).toBe('AL')
  })

  it('gives several words the first letter of each of the first two', () => {
    expect(avatarInitials('Alice Bob Carol', ID)).toBe('AB')
    expect(avatarInitials('Jean-Luc', ID)).toBe('JL')
  })

  it('ignores the space around a name', () => {
    expect(avatarInitials('  bob  ', ID)).toBe('BO')
  })

  /** The two characters after the prefix, as a one-word name gives two. */
  it('shows the two characters after the account ID’s prefix when there is no name, or the name is the ID', () => {
    expect(avatarInitials('', ID)).toBe('AB')
    expect(avatarInitials(ID, ID)).toBe('AB')
  })

  /** The fake's IDs spell their fixture's name, so they are not hex after the prefix. */
  it('skips the prefix of an ID that is not hex', () => {
    expect(avatarInitials('', `05alice${'0'.repeat(59)}`)).toBe('AL')
  })

  it('keeps other scripts and emoji whole', () => {
    expect(avatarInitials('Мария', ID)).toBe('МА')
    expect(avatarInitials('😀 party', ID)).toBe('😀P')
  })

  it('upper-cases for the locale before counting', () => {
    expect(avatarInitials('ßx', ID)).toBe('SS')
  })
})
