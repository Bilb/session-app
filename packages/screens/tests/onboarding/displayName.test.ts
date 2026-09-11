import { describe, expect, it } from 'vitest'

import {
  codePointLength,
  DISPLAY_NAME_MAX_BYTES,
  DISPLAY_NAME_MAX_CODE_POINTS,
  displayNameProblem,
  displayNameRemaining,
  normalizeDisplayName,
  utf8Length,
} from '#src/onboarding/displayName'

/**
 * Two limits bind: libSession's 100 bytes, which is hard and cannot move, and the product's 35
 * characters, which exists because a byte limit is not a length anybody can predict. Which of them
 * bites depends entirely on the script, and that is what most of these pin.
 */
describe('measuring a name', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8Length('Ada')).toBe(3)
    expect(utf8Length('日本語')).toBe(9)
    expect(utf8Length('😀')).toBe(4)
  })

  it('counts code points, not UTF-16 code units', () => {
    // `.length` says 2 for an emoji outside the basic plane, which would let a 35-emoji name
    // through a cap of 35 while counting it as 70.
    expect(codePointLength('😀')).toBe(1)
    expect('😀'.length).toBe(2)
    expect(codePointLength('日本語')).toBe(3)
  })
})

describe('which limit bites, by script', () => {
  const at = (ch: string, n: number) => displayNameProblem(ch.repeat(n))

  it('lets one- and two-byte scripts run to the full 35 characters', () => {
    // Latin is 35 bytes at 35 characters; Greek, Cyrillic, Arabic and Hebrew are 70. The byte
    // limit is nowhere near, so the character cap is the only one that ever fires.
    expect(at('a', 35)).toBeNull()
    expect(at('я', 35)).toBeNull()
    expect(at('ع', 35)).toBeNull()
    expect(at('a', 36)).toBe('tooLong')
  })

  it('stops three-byte scripts at 33, well short of the advertised 35', () => {
    // Chinese, Japanese, Korean, Thai and Devanagari are three bytes a character, so 34 is already
    // 102 bytes. libSession's limit is the binding one and the cap is effectively 33 -- the case
    // worth knowing about, because a field that says 35 refuses a CJK name two characters early.
    expect(at('中', 33)).toBeNull()
    expect(at('中', 34)).toBe('tooLong')
    expect(utf8Length('中'.repeat(34))).toBe(102)
  })

  it('stops emoji at 25', () => {
    expect(at('👍', 25)).toBeNull()
    expect(at('👍', 26)).toBe('tooLong')
  })
})

describe('how much room is left', () => {
  it('reports whichever unit runs out first', () => {
    // Latin: characters run out first, so the count is the character one.
    expect(displayNameRemaining('a'.repeat(30))).toBe(DISPLAY_NAME_MAX_CODE_POINTS - 30)
    // Chinese at 33 characters: 99 bytes, so one byte left against two characters -- the byte
    // count is the one that has run down, which is what makes 33 the real cap.
    expect(displayNameRemaining('中'.repeat(33))).toBe(DISPLAY_NAME_MAX_BYTES - 99)
  })

  it('goes negative by however much is over', () => {
    expect(displayNameRemaining('a'.repeat(38))).toBe(-3)
  })

  it('is the full allowance for an empty name', () => {
    expect(displayNameRemaining('')).toBe(DISPLAY_NAME_MAX_CODE_POINTS)
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

  it('does not restrict which characters may be used', () => {
    // Deliberately no character-class rule: the legacy clients have none, and a name that works
    // on a phone today has to keep working here.
    expect(displayNameProblem('  🦀 <script> ünïcødé ')).toBeNull()
  })
})

describe('a grapheme that is many code points', () => {
  // The emoji the desktop client's own comment names: one grapheme, ten code points, 35 bytes.
  // The limit is counted in code points, so this is where that choice is most visible - and where
  // the byte cap is what keeps it bounded.
  const FAMILY = '👨🏻‍❤️‍💋‍👨🏻'

  it('is one thing to a reader and ten to the counter', () => {
    expect(codePointLength(FAMILY)).toBe(10)
    expect(utf8Length(FAMILY)).toBe(35)
  })

  it('is stopped by the byte limit before the code-point one', () => {
    // Two fit; a third is 105 bytes. Under the character cap alone three would have been accepted,
    // which is the case a grapheme count would have handled differently.
    expect(displayNameProblem(FAMILY.repeat(2))).toBeNull()
    expect(displayNameProblem(FAMILY.repeat(3))).toBe('tooLong')
  })

  it('counts down whichever limit is nearer', () => {
    // Not 35 - 20: the bytes are closer, so the number shown is the bytes.
    expect(displayNameRemaining(FAMILY.repeat(2))).toBe(15)
  })
})

describe('the same name typed two ways', () => {
  // macOS hands back decomposed text from some input paths, so this is not a contrived string:
  // it is what a name can arrive as.
  const COMPOSED = 'é'
  const DECOMPOSED = 'é'

  it('is the same name, and the counter used to disagree', () => {
    expect(COMPOSED.normalize('NFC')).toBe(DECOMPOSED.normalize('NFC'))
    expect(codePointLength(COMPOSED)).toBe(1)
    expect(codePointLength(DECOMPOSED)).toBe(2)
  })

  it('leaves the same room either way', () => {
    expect(displayNameRemaining(DECOMPOSED.repeat(20))).toBe(
      displayNameRemaining(COMPOSED.repeat(20)),
    )
  })

  it('admits 35 of them decomposed, where counting as typed admitted 17', () => {
    expect(displayNameProblem(DECOMPOSED.repeat(35))).toBeNull()
    expect(displayNameProblem(DECOMPOSED.repeat(36))).toBe('tooLong')
  })

  it('normalises the value, not only the count', () => {
    // Counting one form and sending the other is the hazard: 35 of these are 70 bytes composed
    // and 105 decomposed, so libSession would refuse what this screen accepted.
    expect(utf8Length(DECOMPOSED.repeat(35))).toBeGreaterThan(DISPLAY_NAME_MAX_BYTES)
    expect(utf8Length(normalizeDisplayName(DECOMPOSED.repeat(35)))).toBe(70)
  })

  it('does not pretend to fix the scripts that have no composed form', () => {
    // Thai combining vowels and tones do not compose, so this one stays where it was. Noted
    // rather than smoothed over: it is the residual a grapheme count would have covered.
    const THAI = 'สี่'
    expect(normalizeDisplayName(THAI)).toBe(THAI)
    expect(displayNameProblem(THAI.repeat(11))).toBeNull()
    expect(displayNameProblem(THAI.repeat(12))).toBe('tooLong')
  })
})
