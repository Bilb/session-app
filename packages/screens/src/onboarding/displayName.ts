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
 * costs falls on combining marks, and `normalizeDisplayName` is why it costs less than it looks.
 */
export const DISPLAY_NAME_MAX_CODE_POINTS = 35

/**
 * A name in the one form its length can fairly be counted in.
 *
 * **The same name can be two different strings**, and the code-point cap notices while a reader
 * cannot. `é` is one code point composed and two decomposed; a Vietnamese `ệ` is one or three.
 * Counting the decomposed form admits 17 Latin letters where the composed form admits 35, and
 * macOS hands back decomposed text from some input paths -- so whether a name fits could depend on
 * where it was typed, which is not a rule anybody could be expected to predict.
 *
 * NFC is the composed form and the one the web platform standardises on for interchange. It is not
 * a substitute for counting graphemes: Thai and Devanagari matras have no precomposed forms, so a
 * Thai name is still bound at around eleven visible characters. It recovers the Latin and
 * Vietnamese cases entirely, which are the ones a European or Vietnamese name actually lands in,
 * and it costs one call.
 *
 * **It is not a reduction everywhere, and that is not a bug in it.** 85 code points get *longer*
 * under NFC -- 92 counted in bytes -- because Unicode's composition exclusions decompose rather
 * than compose: `U+0958 DEVANAGARI LETTER QA` becomes `क` plus a nukta, one code point becoming
 * two. A name of those admits 33 as typed and 16 normalised. They are the deprecated precomposed
 * forms left over from older encodings -- modern Devanagari input produces the pair, not the
 * singleton -- so this is canonical consistency costing headroom in the legacy case, which is the
 * right way round but is **not** the "strictly more permissive" the first version of this comment
 * implied.
 *
 * **Available on all three platforms**, unlike `Intl.Segmenter`: `stringPrototypeNormalize` and the
 * normalization forms are in the Hermes binary that ships, checked in
 * `apps/mobile/ios/Pods/hermes-engine` rather than assumed.
 *
 * **Applied to the value, not only to the count.** Counting one form and sending another would let
 * a name pass here and be refused by libSession -- decomposed text is longer in bytes, so a name
 * inside 100 bytes composed can be outside it decomposed. The screen submits what was counted.
 */
export function normalizeDisplayName(value: string): string {
  return value.normalize('NFC')
}

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
  const normalized = normalizeDisplayName(name)
  return Math.min(
    DISPLAY_NAME_MAX_CODE_POINTS - codePointLength(normalized),
    DISPLAY_NAME_MAX_BYTES - utf8Length(normalized),
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
