import { describe, expect, it } from 'vitest'

import {
  phraseIsTooShort,
  phraseWords,
  SHORTEST_PHRASE_WORDS,
} from '#src/onboarding/recoveryPhrase'

const thirteen = Array.from({ length: SHORTEST_PHRASE_WORDS }, (_, i) => `word${String(i)}`)

/**
 * Splitting is the whole of it, and it matters because a phrase arrives pasted at least as often
 * as it arrives typed: out of a password manager, a text file, or a photo of a piece of paper.
 */
describe('reading a phrase', () => {
  it('splits on whitespace', () => {
    expect(phraseWords('one two three')).toEqual(['one', 'two', 'three'])
  })

  it('tolerates the mess a paste brings with it', () => {
    // Newlines from a text file, double spaces from a wrapped line, a trailing full stop from
    // prose. The legacy clients accept all three, and a phrase that is correct must not be
    // refused for how it was copied.
    expect(phraseWords('  one\n\ntwo,   three.\t four ')).toEqual(['one', 'two', 'three', 'four'])
  })

  it('lower-cases, because the wordlist is lower case', () => {
    expect(phraseWords('One TWO')).toEqual(['one', 'two'])
  })

  it('keeps the marks a non-English wordlist needs', () => {
    // Japanese, Portuguese and Spanish wordlists all ship, so splitting on anything but letters
    // and marks would tear their words apart.
    expect(phraseWords('café pequeño 日本')).toEqual(['café', 'pequeño', '日本'])
  })

  it('finds nothing in an empty field', () => {
    expect(phraseWords('   \n ')).toEqual([])
  })
})

describe('the one check made before the bridge sees it', () => {
  it('accepts the shortest real phrase', () => {
    expect(phraseIsTooShort(thirteen.join(' '))).toBe(false)
  })

  it('rejects one word fewer', () => {
    expect(phraseIsTooShort(thirteen.slice(0, -1).join(' '))).toBe(true)
  })

  it('accepts a longer one rather than judging it', () => {
    // Length is libsession's to rule on, and a longer phrase is a real option elsewhere in this
    // work. This check exists only to tell half a phrase from a wrong one.
    expect(phraseIsTooShort(Array.from({ length: 25 }, () => 'word').join(' '))).toBe(false)
  })

  it('treats an empty field as too short', () => {
    expect(phraseIsTooShort('')).toBe(true)
  })
})
