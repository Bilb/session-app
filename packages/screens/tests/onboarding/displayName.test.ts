import { describe, expect, it } from 'vitest'

import { DISPLAY_NAME_MAX_BYTES, displayNameProblem, utf8Length } from '#src/onboarding/displayName'

/**
 * The legacy clients impose exactly two rules, and the interesting one is that the limit is in
 * bytes. Measuring characters instead accepts names the bridge then refuses, and the refusal
 * arrives a screen after the field that could have said so.
 */
describe('measuring a name', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8Length('Ada')).toBe(3)
    // Three bytes each in UTF-8, one character each to a reader.
    expect(utf8Length('日本語')).toBe(9)
    // An emoji outside the BMP is four bytes and one grapheme -- and two UTF-16 code units, which
    // is what `.length` would have said.
    expect(utf8Length('😀')).toBe(4)
    expect('😀'.length).toBe(2)
  })
})

describe('validating a name', () => {
  it('accepts an ordinary one', () => {
    expect(displayNameProblem('Ada Lovelace')).toBeNull()
  })

  it('rejects a blank one', () => {
    expect(displayNameProblem('')).toBe('empty')
    expect(displayNameProblem('   ')).toBe('empty')
  })

  it('accepts a name exactly at the limit', () => {
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_BYTES))).toBeNull()
  })

  it('rejects one byte past it', () => {
    expect(displayNameProblem('a'.repeat(DISPLAY_NAME_MAX_BYTES + 1))).toBe('tooLong')
  })

  it('rejects a short name that is long in bytes', () => {
    // Twenty-six emoji: 26 graphemes, 104 bytes. The case the byte limit exists for, and the one
    // a character count would wave through.
    const emoji = '😀'.repeat(26)
    expect(emoji.length).toBeLessThan(DISPLAY_NAME_MAX_BYTES)
    expect(displayNameProblem(emoji)).toBe('tooLong')
  })

  it('does not restrict which characters may be used', () => {
    // Deliberately no character-class rule: the legacy clients have none, and a name that works
    // on a phone today has to keep working here.
    expect(displayNameProblem('  🦀 <script> ünïcødé ')).toBeNull()
  })
})
