/**
 * How long a display name may be, in **UTF-8 bytes rather than characters**.
 *
 * This is libSession's limit, not a UI one, which is why it is counted the way the wire counts it:
 * a hundred-character ASCII name fits and a thirty-four-character emoji name does not. Counting
 * `name.length` instead would accept names the bridge then refuses, and the refusal would arrive a
 * screen later than the field that could have said so.
 */
export const DISPLAY_NAME_MAX_BYTES = 100

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
 * Whether a display name can be used, following the legacy clients exactly.
 *
 * Two rules and no others: it cannot be blank, and it cannot exceed the byte limit. Deliberately
 * no character-class restriction and no trimming beyond the blank check -- the legacy clients
 * impose neither, and a name that works on a phone today has to keep working here.
 */
export function displayNameProblem(name: string): DisplayNameProblem | null {
  if (name.trim().length === 0) return 'empty'
  if (utf8Length(name) > DISPLAY_NAME_MAX_BYTES) return 'tooLong'
  return null
}
