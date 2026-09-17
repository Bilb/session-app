import type { LanguageChoice } from './LanguagePicker.types'

/**
 * The rows a search term keeps.
 *
 * Its own module, and pure, so it can be tested: the rest of the picker is tamagui and a `Modal`,
 * which this package has no renderer for, and the filter is the part that can actually be wrong.
 *
 * **Three matchers: the name as written, the name in English, and the code.** For three different
 * people -- one scanning for their own language, one looking at a script they cannot read who
 * types `japanese`, one who knows the list and types `pt-BR`. None covers the others, and all are
 * cheap over eighty rows.
 *
 * Deliberately not every exonym: matching Japanese in French and Arabic too needs CLDR's full name
 * tables, a large dependency for somebody searching in a language they have not selected. Chrome,
 * Firefox and Android's picker settle on the same three.
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
      (option.english ?? '').toLocaleLowerCase().includes(needle) ||
      option.value.toLocaleLowerCase().includes(needle),
  )
}
