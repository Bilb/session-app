import type { LanguageChoice } from './LanguagePicker.types'

/**
 * The rows a search term keeps.
 *
 * Its own module, and pure, so it can be tested: the rest of the picker is tamagui and a `Modal`,
 * which this package has no renderer for, and the filter is the part that can actually be wrong.
 *
 * Matched against the locale code as well as the name. Two different people need that: one knows
 * the list and types `pt-BR`, and one is looking at an interface in a language they cannot read
 * and types `de` because `Deutsch` is not a word they would think to try. Both are cheap over
 * eighty rows, and neither works without the other.
 *
 * `toLocaleLowerCase` rather than `toLowerCase`, because the list is mostly not English: Turkish
 * dotted and dotless I are the case that breaks, and Turkish is in the list.
 */
export function filterLanguages(
  options: readonly LanguageChoice[],
  query: string,
): readonly LanguageChoice[] {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return options
  return options.filter(
    (option) =>
      option.label.toLocaleLowerCase().includes(needle) ||
      option.value.toLocaleLowerCase().includes(needle),
  )
}
