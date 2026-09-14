import {
  crowdinLocales,
  isCrowdinLocale,
  type CrowdinLocale,
} from './localization-src/generated/constants'
import { LANGUAGE_NAMES, LANGUAGE_REGIONS } from './generated/languages'

/**
 * The language picker's list, and the two pieces of per-language presentation it needs.
 *
 * Hand-written against a generated table: the data cannot be computed on mobile, because Hermes
 * ships neither `Intl.DisplayNames` nor `Intl.Locale`, but the judgement about how to present it
 * has to stay editable without regenerating anything.
 */

/**
 * The flag shown beside a language.
 *
 * A flag belongs to a country and a language does not, so this mapping is approximate by nature
 * and unhelpful in places by design. Two measured facts about the current list:
 *
 * - **Three locales have no country at all.** Esperanto maximizes to `001` (World), `es-419` to
 *   `419` (Latin America), and `sr-SP` to `SP`, which is not an assigned ISO code. They get the
 *   globe.
 * - **Twenty-three rows share a flag with another row.** Five languages resolve to India, four to
 *   Spain, three each to Türkiye and Norway. A flag that appears five times identifies nothing,
 *   and several of those groupings are contentious rather than merely unhelpful.
 *
 * Hence this map. The second point is an unsettled question about the product rather than a data
 * problem to solve here, and an override table is what lets it be answered later by editing one
 * object instead of the picker. An entry wins over the generated region; `null` means the globe.
 */
const FLAG_OVERRIDES: Partial<Record<CrowdinLocale, string | null>> = {}

/** Shown wherever a language has no country. A real answer, not a missing one. */
export const NO_FLAG = '🌐'

/**
 * A region code as its flag emoji.
 *
 * The two letters map onto the regional indicator symbols at U+1F1E6, which a font draws as a flag
 * when it recognises the pair. Codepoint arithmetic rather than a table of 250 flags, and the
 * generator has already discarded the codes no font would recognise.
 */
function flagFor(region: string): string {
  return String.fromCodePoint(
    ...[...region.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  )
}

export function languageFlag(locale: CrowdinLocale): string {
  const region = locale in FLAG_OVERRIDES ? FLAG_OVERRIDES[locale] : LANGUAGE_REGIONS[locale]
  return region === null || region === undefined ? NO_FLAG : flagFor(region)
}

/** The locale's own name for itself, falling back to the code so a row is never blank. */
export function languageName(locale: CrowdinLocale): string {
  return LANGUAGE_NAMES[locale] ?? locale
}

export interface LanguageOption {
  locale: CrowdinLocale
  /** The language's name in that language, which is what the row reads. */
  name: string
  flag: string
}

/**
 * Every language the app ships, ordered for a picker.
 *
 * Sorted by the name as written, not by locale code, because the code is not what anybody is
 * scanning down. `localeCompare` with no locale argument rather than a fixed one: the list mixes
 * scripts, and no single collation is right for all of them, so the reader's own is the least
 * wrong choice available.
 *
 * Built once at module scope. It is eighty rows that never change within a run, and rebuilding it
 * per render would sort on every keystroke of the filter.
 */
export const LANGUAGES: readonly LanguageOption[] = [...crowdinLocales]
  .map((locale) => ({ locale, name: languageName(locale), flag: languageFlag(locale) }))
  .sort((a, b) => a.name.localeCompare(b.name))

/**
 * Where a script says which region's catalogue to use.
 *
 * The catalogue names Chinese by region and every platform reports it by script, so `zh-Hans` and
 * `zh-CN` are the same language written two ways and nothing in the tag says so. This is the only
 * such pair today; it is a table rather than a rule because the mapping is a fact about written
 * Chinese, not something derivable from the tag.
 */
const SCRIPT_TO_LOCALE: Record<string, CrowdinLocale> = {
  'zh-hans': 'zh-CN',
  'zh-hant': 'zh-TW',
}

/**
 * The best match for a language tag the device reported, or null when nothing matches.
 *
 * **Truncated one subtag at a time, which is how BCP-47 says to do it.** `pt-BR` finds Brazilian
 * Portuguese rather than falling straight to European, and `zh-Hans-AU` -- what iOS reports when
 * the app's language is Simplified Chinese on an Australian device -- reaches `zh-Hans` and then
 * the table above. Trying only the whole tag and then its bare base missed both of those: the
 * catalogue has no bare `zh`, so Chinese matched nothing at all and the app stayed in English.
 *
 * Last, a language with exactly one shipped variant matches it, so bare `hy` finds `hy-AM`. Only
 * when there is exactly one: bare `pt` could be either Portuguese and picking one would be
 * inventing an answer the tag did not give.
 *
 * Null rather than English: the caller decides what an unsupported system language should do, and
 * silently showing a flag nobody chose states something untrue about the current setting.
 */
export function matchLocale(tag: string): CrowdinLocale | null {
  const subtags = tag.split('-')
  for (let length = subtags.length; length > 0; length -= 1) {
    const candidate = subtags.slice(0, length).join('-')
    if (isCrowdinLocale(candidate)) return candidate
    const byScript = SCRIPT_TO_LOCALE[candidate.toLowerCase()]
    if (byScript !== undefined) return byScript
  }

  const base = `${subtags[0] ?? ''}-`.toLowerCase()
  const variants = crowdinLocales.filter((locale) => locale.toLowerCase().startsWith(base))
  return variants.length === 1 ? (variants[0] ?? null) : null
}
