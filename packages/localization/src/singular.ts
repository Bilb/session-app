import {
  enPlurals,
  translationsPlurals,
  type TokenPluralWithArgs,
} from './localization-src/generated/locales'
import { getLocale } from './localeStore'

/**
 * A plural string's singular form, in the current language, without asking `Intl.PluralRules`.
 *
 * `tr` resolves a plural through `Intl.PluralRules`, and in the mobile app it answers with the
 * token's own name instead (seen on Android): the rules are not there to ask. A string that only
 * ever means one -- "You've got a new message." -- does not need them.
 */
export function singular(token: TokenPluralWithArgs): string {
  const locale = getLocale()
  const forms =
    (locale === 'en' ? undefined : translationsPlurals[locale]?.[token]) ?? enPlurals[token]
  return (forms?.one ?? forms?.other ?? token).replaceAll('#', '1').replaceAll('{count}', '1')
}
