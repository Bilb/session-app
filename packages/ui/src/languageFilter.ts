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
 * **Folded with `toLowerCase`, not `toLocaleLowerCase`, which uses the device's own locale.**
 * The rows come from the catalogue and the term comes from a keyboard, so both have to be folded
 * by the same rule or they cannot be compared. The device's rule is not that: on a Turkish one it
 * maps `I` to a dotless letter, so no language in the list beginning with an I can be found by
 * typing its name in ASCII.
 */
export function filterLanguages(
  options: readonly LanguageChoice[],
  query: string,
): readonly LanguageChoice[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return options
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      (option.english ?? '').toLowerCase().includes(needle) ||
      option.value.toLowerCase().includes(needle),
  )
}
