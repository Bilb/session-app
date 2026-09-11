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

describe('the letters NFC takes apart rather than puts together', () => {
  /**
   * `U+0958 DEVANAGARI LETTER QA`, a Unicode composition exclusion: NFC turns it into `क` plus a
   * nukta, so it gets longer rather than shorter. Named by code point rather than pasted, because
   * the whole point is that it is not the sequence it looks like.
   */
  const QA = String.fromCodePoint(0x0958)

  it('grows under normalisation instead of shrinking', () => {
    expect(codePointLength(QA)).toBe(1)
    expect(codePointLength(normalizeDisplayName(QA))).toBe(2)
    expect(utf8Length(normalizeDisplayName(QA))).toBe(6)
  })

  it('costs headroom rather than recovering it', () => {
    // 33 of them fit as typed and 16 normalised, so for these letters normalising is the expense.
    // Accepted deliberately: these are the deprecated precomposed forms, and modern input produces
    // the decomposed pair that normalising leaves alone.
    expect(displayNameProblem(QA.repeat(16))).toBeNull()
    expect(displayNameProblem(QA.repeat(17))).toBe('tooLong')
  })

  it('is refused consistently, rather than passing here and failing on the wire', () => {
    // The mirror of the decomposed-acute hazard: 30 of these are 90 bytes as typed and 180
    // normalised. Counting the typed form would admit a name libSession then refuses. The value
    // and the count are the same string, so both sides see 180.
    expect(utf8Length(QA.repeat(30))).toBe(90)
    expect(utf8Length(normalizeDisplayName(QA.repeat(30)))).toBe(180)
    expect(displayNameProblem(QA.repeat(30))).toBe('tooLong')
  })
})

describe('the characters normalisation replaces outright', () => {
  // Canonical singletons: one code point maps to a different one. Pinned so that nobody later
  // reads "the stored name is not what was typed" as a bug and drops the normalisation of the
  // value - which would put back the mismatch between what is counted and what is sent.
  it.each([
    ['U+037E GREEK QUESTION MARK', 0x037e, 0x003b],
    ['U+2126 OHM SIGN', 0x2126, 0x03a9],
    ['U+212B ANGSTROM SIGN', 0x212b, 0x00c5],
  ])('replaces %s, and that is canonical rather than lossy', (_name, from, to) => {
    const typed = String.fromCodePoint(from)
    const stored = normalizeDisplayName(typed)
    expect(stored).not.toBe(typed)
    expect(stored.codePointAt(0)).toBe(to)
    // Canonically equivalent, which is what makes the substitution safe: both sides agree.
    expect(typed.normalize('NFC')).toBe(stored.normalize('NFC'))
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
  })
})
