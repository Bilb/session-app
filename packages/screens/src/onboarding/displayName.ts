/**
 * How long a display name may be, in **UTF-8 bytes rather than characters**.
 *
 * libSession's limit -- `contact_info::MAX_NAME_LENGTH` -- and therefore the hard one: the bridge
 * throws rather than truncating. Counted the way the wire counts it, so a hundred-character ASCII
 * name fits and a thirty-four-character emoji name does not.
 */
export const DISPLAY_NAME_MAX_BYTES = 100

/**
 * How long a display name may be in **code points**, which is the limit a person can feel.
 *
 * A byte limit is not a length anybody can predict: seventeen thumbs-up emoji are 68 bytes and
 * sixty-five ASCII characters are 65, so the same field would accept four times as much of one as
 * of the other. The character cap exists to make it consistent, and 35 is the number the product
 * settled on for display names, group names and nicknames alike.
 *
 * **Code points rather than graphemes**, matching the limit Pro message lengths use. Graphemes are
 * the more human unit -- a family emoji is one grapheme and seven code points -- but counting them
 * needs `Intl.Segmenter`, and Hermes has no `Intl` beyond `Collator`, `DateTimeFormat` and
 * `NumberFormat`. Mobile would need a polyfill to agree with desktop, and a limit the platforms
 * disagree about is worse than one that is slightly generous to emoji.
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
 * `Array.from` rather than `.length`, which counts UTF-16 code units and therefore counts every
 * emoji outside the basic plane twice.
 */
export function codePointLength(value: string): number {
  return Array.from(value).length
}

/**
 * How much room is left, in whichever unit runs out first.
 *
 * **Both limits bind, and which one bites depends on the script.** At 35 code points Latin is 35
 * bytes and Greek, Cyrillic, Arabic and Hebrew are 70, so for those the character cap is the only
 * one that ever fires. Chinese, Japanese, Korean, Thai and Devanagari are three bytes each, so the
 * byte limit binds first and the effective cap is **33**; emoji are four bytes and cap at **25**.
 *
 * That asymmetry is not a bug to be smoothed over -- 100 bytes is libSession's and cannot move --
 * but it is worth a caller knowing, because a field that advertises 35 and stops a CJK name at 33
 * has to stop accepting input rather than explain itself afterwards.
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
