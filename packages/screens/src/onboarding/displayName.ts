/**
 * How long a display name may be, in **UTF-8 bytes rather than characters**.
 *
 * **This is a copy of libSession's `contact_info::MAX_NAME_LENGTH`**, which is not exposed across
 * the bridge, so the two have to be changed together. It is the hard limit either way: the bridge
 * throws rather than truncating.
 *
 * The same limit applies to group names and nicknames, so an editor for either should import this
 * rather than write its own check.
 *
 * ⚠️ **`String.length` and `String.slice` are neither bytes nor code points.** They count UTF-16
 * units, which coincide with both only for ASCII -- so a `.length` check against a byte limit
 * admits three times the limit in Chinese, and `.slice` can cut a surrogate pair in half and leave
 * half a character. Use `utf8Length` for the wire and `codePointLength` for the felt limit.
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
 *
 * **Deliberately not normalised**, here or for the byte limit: both count the string as typed.
 * Normalising to NFC would make the count fairer, since decomposed text spends more code points --
 * but it changes the value as well, replacing characters outright (`U+2126 OHM SIGN` becomes a
 * capital omega). Nobody reads that as canonical equivalence; they read it as their name coming
 * back wrong. Decomposed input simply has less room.
 */
export const DISPLAY_NAME_MAX_CODE_POINTS = 35

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
 * `Array.from` iterates code points. `.length` would count UTF-16 units instead, so an emoji
 * outside the basic plane counts as two there and as one here.
 */
export function codePointLength(value: string): number {
  return Array.from(value).length
}

/**
 * The name as it will be stored, with the edges taken off.
 *
 * **One boundary for the whole screen**, because the limit, the emptiness check and what is sent
 * have to agree about which characters count. A leading space is what an autocorrect leaves behind
 * after a deleted word, and it would otherwise be stored, synced to every linked device and shown
 * in conversation lists -- and spent against both limits, so a name of the advertised length is
 * refused for a space nobody can see.
 *
 * Only the edges. Whitespace inside a name is the name.
 */
export function displayNameAsStored(name: string): string {
  return name.trim()
}

/**
 * How much room is left, in whichever unit runs out first.
 *
 * **Which limit bites depends on the script**: Latin hits the 35 characters, CJK hits the bytes at
 * 33 and emoji at 25. Worth a caller knowing, because a field that advertises 35 and stops a CJK
 * name at 33 has to stop accepting input rather than explain itself afterwards.
 */
export function displayNameRemaining(name: string): number {
  const stored = displayNameAsStored(name)
  return Math.min(
    DISPLAY_NAME_MAX_CODE_POINTS - codePointLength(stored),
    DISPLAY_NAME_MAX_BYTES - utf8Length(stored),
  )
}

/**
 * Whether a display name can be used.
 *
 * Blank is rejected, as the legacy clients do. Deliberately no character-class restriction: they
 * impose none, and a name that works on a phone today has to keep working here.
 */
export function displayNameProblem(name: string): DisplayNameProblem | null {
  if (displayNameAsStored(name).length === 0) return 'empty'
  if (displayNameRemaining(name) < 0) return 'tooLong'
  return null
}
