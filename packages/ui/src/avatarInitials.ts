/** The prefixes an account ID starts with, which say what kind of ID it is rather than whose. */
const ID_PREFIX = /^(05|15|25|00|03)[0-9a-f]{2,}$/i

/**
 * Characters as a reader counts them. An emoji built from several code points is one, and so is a
 * letter with its accent; slicing code units would cut an emoji initial in half.
 * Code points where the runtime has no segmenter, which splits only the composed emoji.
 */
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function')
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
      (part) => part.segment,
    )
  return Array.from(text)
}

/**
 * The letters an avatar shows until it has a picture: one rule for every platform, where the three
 * clients each have their own.
 *
 * - **A name of one word gives its first two characters**, as all three do.
 * - **Several words give the first character of each of the first two**, split at spaces and
 *   hyphens as the desktop client splits them.
 * - **No name falls back to the account ID, past its prefix**, and takes the two characters after
 *   it, the way a one-word name gives two -- the product owner's call, so an unnamed avatar is as
 *   full as a named one.
 * - Letters of any script and emoji are kept whole, as the phones keep them.
 * - Upper-cased for the locale before counting, so a German ß becomes the SS it is in capitals.
 */
export function avatarInitials(name: string, id: string): string {
  const trimmed = name.trim()
  // With no name the ID is taken past its prefix whatever follows it. The pattern only tells a name
  // that is an ID from one that is not.
  if (trimmed === '' || ID_PREFIX.test(trimmed))
    return graphemes(trimmed === '' ? id.trim() : trimmed)
      .slice(2, 4)
      .join('')
      .toLocaleUpperCase()

  const words = trimmed.split(/[\s-]+/).filter((word) => word !== '')
  const letters =
    words.length > 1
      ? words.slice(0, 2).map((word) => graphemes(word)[0] ?? '')
      : graphemes(words[0] ?? '').slice(0, 2)
  return graphemes(letters.join('').toLocaleUpperCase()).slice(0, 2).join('')
}
