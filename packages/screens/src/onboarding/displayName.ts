/**
 * What a name may be, and in which unit.
 *
 * **The same 35 and the same 100 bytes apply to group names and nicknames**, so when either of
 * those grows an editor it should import these rather than write its own check. The whole subject
 * is one where two correct answers disagree, and this module is where that is worked out once.
 *
 * ⚠️ **`String.length` and `String.slice` are the trap, and they are nobody's unit.** They count
 * UTF-16 code units: neither bytes, nor code points, nor graphemes. They coincide with all three
 * for ASCII, which is what makes the mistake invisible until somebody types outside it -- one CJK
 * character is 1 unit and 3 bytes, one emoji is 2 units and 4 bytes. A `.length` check against a
 * byte limit therefore admits three times the limit in Chinese and twice it in emoji, and a
 * `.slice` to that limit shortens neither.
 *
 * Worse, `.slice` can cut a surrogate pair in half and leave a lone surrogate -- half a character,
 * which is not valid text to encode at all. A name field is exactly where somebody puts an emoji.
 *
 * So: `utf8Length` for the wire and `codePointLength` for the felt limit, both over the string
 * exactly as it was typed -- see below for why it is not normalised first.
 */

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
 * the more human unit: the emoji the desktop client's own comment picks out, `👨🏻‍❤️‍💋‍👨🏻`, is one
 * grapheme, ten code points, fifteen UTF-16 units and thirty-five bytes -- four different answers
 * to "how long is this". But counting graphemes needs `Intl.Segmenter`, and Hermes has no `Intl`
 * beyond `Collator`, `DateTimeFormat` and `NumberFormat`, so mobile would need a segmentation
 * library to agree with desktop. A limit the platforms disagree about is worse than one that is
 * slightly generous to emoji.
 *
 * **The generosity is bounded by the byte cap**, which is why the pathological case is not one.
 * Under the code-point limit alone that emoji would fit three times over; the hundred bytes stop
 * it at two, and the counter shows whichever limit is nearer. So the worst a grapheme-blind count
 * costs is that a name of pure multi-code-point emoji is refused sooner than 35 of them, not later.
 *
 * Emoji are therefore the *least* affected case, being byte-bound either way. What the unit really
 * costs falls on combining marks: decomposed text spends more code points than the same name
 * composed, and that cost is accepted rather than normalised away, for the reason below.
 */
export const DISPLAY_NAME_MAX_CODE_POINTS = 35

/**
 * **Deliberately not normalised.** The name that is stored is the name that was typed.
 *
 * Normalising to NFC was tried and reverted. It made the limit fairer -- decomposed text counts
 * more code points than the same name composed, so `é` typed on a Mac could cost twice what the
 * same letter cost elsewhere -- but it changed the value as well as the count, and canonical
 * singletons replace characters outright: `U+2126 OHM SIGN` becomes a capital omega, `U+212B
 * ANGSTROM SIGN` becomes an A-ring.
 *
 * The objection to it, and it is right: **a person would not read that as canonical
 * equivalence, they would read it as their name coming back wrong.** Type a name on one device,
 * link a second, and see something you did not type. A stricter limit for decomposed text is a
 * cost paid once by a few people; a name that changes under you is a bug report.
 *
 * So both limits count the string as typed, and decomposed input simply has less room. The
 * consequence worth knowing: `displayNameRemaining` can differ for two names a reader cannot tell
 * apart, and that is the accepted trade rather than an oversight.
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
