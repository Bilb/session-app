/**
 * What a name may be, and in which unit.
 *
 * The same limits apply to group names and nicknames, so an editor for either should import these
 * rather than write its own check.
 *
 * ⚠️ **`String.length` and `String.slice` are neither bytes nor code points.** They count UTF-16
 * units, which coincide with both only for ASCII -- so a `.length` check against a byte limit
 * admits three times the limit in Chinese, and `.slice` can cut a surrogate pair in half and leave
 * half a character. Use `utf8Length` for the wire and `codePointLength` for the felt limit.
 */

/**
 * How long a display name may be, in **UTF-8 bytes rather than characters**.
 *
 * libSession's `contact_info::MAX_NAME_LENGTH`, and therefore the hard one: the bridge throws
 * rather than truncating.
 */
export const DISPLAY_NAME_MAX_BYTES = 100

/**
 * How long a display name may be in **code points**, which is the limit a person can feel.
 *
 * A byte limit is not a length anybody can predict -- seventeen emoji and sixty-five ASCII
 * characters are both about 68 bytes -- so this caps it in a unit that behaves the same whatever
 * is typed.
 *
 * **Code points rather than graphemes**, which are the more human unit, because counting graphemes
 * needs `Intl.Segmenter` and Hermes ships no `Intl` beyond `Collator`, `DateTimeFormat` and
 * `NumberFormat`. Mobile would need a segmentation library to agree with desktop, and a limit the
 * platforms disagree about is worse than one that is slightly generous to emoji. The byte cap
 * bounds that generosity anyway.
 */
export const DISPLAY_NAME_MAX_CODE_POINTS = 35

/**
 * **Deliberately not normalised.** The name that is stored is the name that was typed.
 *
 * Normalising to NFC would make the limit fairer, since decomposed text spends more code points
 * than the same name composed. But it changes the value as well as the count -- canonical
 * singletons replace characters outright, so `U+2126 OHM SIGN` becomes a capital omega -- and
 * nobody reads that as canonical equivalence. They read it as their name coming back wrong.
 *
 * So both limits count the string as typed, and decomposed input simply has less room.
 */

/** What is wrong with a name, or null when nothing is. */
export type DisplayNameProblem = 'empty' | 'tooLong'

/**
 * The byte length of a string as UTF-8.
 *
 * `TextEncoder` rather than a hand-rolled counter because it is present on all three platforms --
 * Hermes ships it even though it ships almost no `Intl` -- and because a hand-rolled one gets
 * surrogate pairs wrong, which is exactly the case this limit is about.
 */
export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length
}

/**
 * The number of code points in a string.
 *
 * `Array.from` rather than `.length`, which counts UTF-16 code units and therefore counts every
 * emoji outside the basic plane twice.
 */
export function codePointLength(value: string): number {
  return Array.from(value).length
}

/**
 * How much room is left, in whichever unit runs out first.
 *
 * **Which limit bites depends on the script**: Latin hits the 35 characters, CJK hits the bytes at
 * 33 and emoji at 25. Worth a caller knowing, because a field that advertises 35 and stops a CJK
 * name at 33 has to stop accepting input rather than explain itself afterwards.
 */
export function displayNameRemaining(name: string): number {
  return Math.min(
    DISPLAY_NAME_MAX_CODE_POINTS - codePointLength(name),
    DISPLAY_NAME_MAX_BYTES - utf8Length(name),
  )
}

/**
 * Whether a display name can be used.
 *
 * Blank is rejected, as the legacy clients do. Deliberately no character-class restriction: they
 * impose none, and a name that works on a phone today has to keep working here.
 */
export function displayNameProblem(name: string): DisplayNameProblem | null {
  if (name.trim().length === 0) return 'empty'
  if (displayNameRemaining(name) < 0) return 'tooLong'
  return null
}
