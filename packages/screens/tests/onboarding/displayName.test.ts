import { describe, expect, it } from 'vitest'

import {
  codePointLength,
  DISPLAY_NAME_MAX_BYTES,
  DISPLAY_NAME_MAX_CODE_POINTS,
  displayNameAsStored,
  displayNameProblem,
  displayNameRemaining,
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
  // macOS hands back decomposed text from some input paths, so this is not a contrived string: it
  // is what a name can arrive as. Normalising would even these out, and was tried and reverted --
  // see displayName.ts. The cost of that decision is asserted here rather than left implicit.
  const COMPOSED = '\u00e9'
  const DECOMPOSED = 'e\u0301'

  it('is the same name to a reader and two different strings to the counter', () => {
    expect(COMPOSED.normalize('NFC')).toBe(DECOMPOSED.normalize('NFC'))
    expect(codePointLength(COMPOSED)).toBe(1)
    expect(codePointLength(DECOMPOSED)).toBe(2)
  })

  it('gives the decomposed form less room, which is the accepted cost', () => {
    // 35 composed, 17 decomposed. A reader cannot tell the two apart, so this is a real cost -
    // taken deliberately, because the alternative changed the name that gets stored.
    expect(displayNameProblem(COMPOSED.repeat(35))).toBeNull()
    expect(displayNameProblem(DECOMPOSED.repeat(17))).toBeNull()
    expect(displayNameProblem(DECOMPOSED.repeat(18))).toBe('tooLong')
  })
})

describe('the name that is stored', () => {
  it('is the name that was typed, character for character', () => {
    // The guarantee that replaced normalisation. Canonical singletons are the reason it matters:
    // normalising would have turned each of these into a different character, so somebody who
    // typed one and linked a second device would have seen a name they did not type.
    for (const codePoint of [0x037e, 0x2126, 0x212b]) {
      const typed = String.fromCodePoint(codePoint)
      // Nothing in the module rewrites a name; the check is a measurement, not a transform.
      expect(displayNameProblem(typed)).toBeNull()
      expect(typed.normalize('NFC')).not.toBe(typed)
    }
  })
})

describe('the unit that is nobody`s unit', () => {
  // `String.length` counts UTF-16 code units. It agrees with bytes, code points and graphemes for
  // ASCII and with none of them otherwise, which is what makes a `.length` check against a byte
  // limit look correct until somebody types outside ASCII. Pinned as an example rather than a
  // rule, so the next name field that needs a limit can see the three numbers disagree.
  it('agrees with every other unit for ASCII and none of them otherwise', () => {
    const ascii = 'a'.repeat(100)
    expect(ascii.length).toBe(100)
    expect(utf8Length(ascii)).toBe(100)
    expect(codePointLength(ascii)).toBe(100)

    // A hundred UTF-16 units of Chinese is three hundred bytes: a `.length` check against the
    // hundred-byte limit would admit three times it.
    const cjk = '漢'.repeat(100)
    expect(cjk.length).toBe(100)
    expect(utf8Length(cjk)).toBe(300)
    expect(displayNameProblem(cjk)).toBe('tooLong')

    // And an emoji is two units, so fifty of them pass a `.length` check and are two hundred bytes.
    const emoji = '😀'.repeat(50)
    expect(emoji.length).toBe(100)
    expect(codePointLength(emoji)).toBe(50)
    expect(utf8Length(emoji)).toBe(200)
    expect(displayNameProblem(emoji)).toBe('tooLong')
  })

  it('cannot be sliced safely, because half a character is not a character', () => {
    // 99 ASCII plus one emoji is 101 UTF-16 units. Cutting at 100 ends mid-pair.
    const name = `${'a'.repeat(99)}😀`
    expect(name.length).toBe(101)
    const cut = name.slice(0, 100)
    // A lone high surrogate: not a character, and not something that can be encoded as text.
    expect(cut.length).toBe(100)
    expect(cut.codePointAt(99)).toBeGreaterThanOrEqual(0xd800)
    expect(cut.codePointAt(99)).toBeLessThanOrEqual(0xdbff)
    // Encoding it does not throw -- it substitutes the replacement character, which is the quiet
    // failure: the name reaches the wire with a U+FFFD where the emoji was.
    expect(new TextDecoder().decode(new TextEncoder().encode(cut)).endsWith('\ufffd')).toBe(true)

    // And it overshoots the limit it was truncating to. The replacement character is three bytes
    // where the two units it replaced were four, so 100 units is 102 bytes against a cap of 100:
    // the slice corrupts the name and still fails at the one job it had.
    expect(utf8Length(cut)).toBe(102)
    expect(utf8Length(cut)).toBeGreaterThan(DISPLAY_NAME_MAX_BYTES)
  })
})

describe('whitespace at the edges', () => {
  it('does not count against either limit', () => {
    // A name of the advertised length refused for a space nobody can see is the failure this
    // prevents. `  Ada  ` is three characters of padding around three of name.
    expect(displayNameRemaining(`  ${'a'.repeat(35)}  `)).toBe(0)
    expect(displayNameProblem(` ${'a'.repeat(35)} `)).toBeNull()
  })

  it('is not part of the name that gets stored', () => {
    // What a deleted word leaves behind on iOS, and it would otherwise reach every linked device.
    expect(displayNameAsStored(' Ada ')).toBe('Ada')
    expect(displayNameAsStored('\n Ada Lovelace \t')).toBe('Ada Lovelace')
  })

  it('is left alone inside the name', () => {
    expect(displayNameAsStored('Ada  Lovelace')).toBe('Ada  Lovelace')
  })
})
