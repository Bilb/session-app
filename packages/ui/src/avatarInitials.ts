/** The prefixes an account ID starts with, which say what kind of ID it is rather than whose. */
const ID_PREFIX = /^(05|15|25|00|03)[0-9a-f]{2,}$/i

/**
 * Characters as a reader counts them, so an emoji initial is not cut in half. Code points where
 * the runtime has no segmenter, which splits only composed emoji.
 */
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function')
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
      (part) => part.segment,
    )
  return Array.from(text)
}

/**
 * The letters an avatar shows until it has a picture, one rule for every platform:
 * - one word gives its first two characters; several give the first of each of the first two,
 *   split at spaces and hyphens as the desktop client splits them;
 * - no name gives the two characters after the account ID's prefix (the product owner's call);
 * - upper-cased for the locale before counting, so ß becomes SS.
 */
export function avatarInitials(name: string, id: string): string {
  const trimmed = name.trim()
  // The pattern only spots a name that is an ID; the ID itself is sliced whatever its content.
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
