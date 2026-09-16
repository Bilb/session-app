import type { LanguageChoice } from './LanguagePicker.types'

/**
 * The rows a search term keeps.
 *
 * Its own module, and pure, so it can be tested: the rest of the picker is tamagui and a `Modal`,
 * which this package has no renderer for, and the filter is the part that can actually be wrong.
 *
 * **Three matchers: the name as written, the name in English, and the code.** They are for three
 * different people -- one scanning for their own language, one looking at an interface in a script
 * they cannot read who types `japanese`, and one who knows the list and types `pt-BR`. All three
 * are cheap over eighty rows and none of them covers the others.
 *
 * Deliberately not every exonym. Matching Japanese in French, German and Arabic as well needs
 * CLDR's full name tables, which is a large dependency for a case that barely arises: somebody
 * searching in a language they have not selected. Own name, English name and code is what Chrome,
 * Firefox and Android's own picker settle on.
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
