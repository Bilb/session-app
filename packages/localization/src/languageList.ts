import {
  crowdinLocales,
  isCrowdinLocale,
  type CrowdinLocale,
} from './localization-src/generated/constants'
import {
  LANGUAGE_NAMES,
  LANGUAGE_NAMES_EN,
  LANGUAGE_REGIONS,
  RTL_LOCALES,
} from './generated/languages'

/**
 * The flag shown beside a language.
 *
 * This and the name overrides below are hand-written against a generated table: the data cannot be
 * computed on mobile, because Hermes ships neither `Intl.DisplayNames` nor `Intl.Locale`, but the
 * judgement about how to present it has to stay editable without regenerating anything.
 *
 * A flag belongs to a country and a language does not, so the mapping is approximate by nature.
 * Three locales maximize to no country at all and get the globe; twenty-three share a flag with
 * another row, several of those contentiously.
 *
 * That second point is an unsettled product question rather than a data problem, so it lives in an
 * override table that can answer it later without regenerating anything. An entry wins over the
 * generated region; `null` means the globe.
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

/**
 * Where CLDR's name for a locale would leave two rows reading the same word.
 *
 * `tl` and `fil` are the case: CLDR treats Tagalog as the old code for Filipino and names both
 * the same, in every language. The catalogues are **not** the same translation -- about 70% of the
 * strings differ -- so two identical rows offer a choice nobody can make. Tagalog is what `tl` is.
 *
 * An override table rather than a generator fix, for the same reason `FLAG_OVERRIDES` is one: this
 * is editorial judgement about the list. Legacy iOS instead drops `tl` at generation time, which
 * is cleaner but discards a real translation.
 */
const NAME_OVERRIDES: Partial<Record<CrowdinLocale, { name: string; english: string }>> = {
  tl: { name: 'Tagalog', english: 'Tagalog' },
  // The same collision, found by the test that was written for the one above. CLDR resolves `ku`
  // to Kurmanji and then gives `kmr`, which *is* Kurmanji, the identical parenthesised name. Here
  // the two really are the same language, `kmr` being the more specific code, so the rows are
  // named by what each code means rather than being told apart by invention.
  ku: { name: 'Kurdî', english: 'Kurdish' },
  kmr: { name: 'Kurdî (Kurmancî)', english: 'Northern Kurdish' },
}

/** The locale's own name for itself, falling back to the code so a row is never blank. */
export function languageName(locale: CrowdinLocale): string {
  return NAME_OVERRIDES[locale]?.name ?? LANGUAGE_NAMES[locale] ?? locale
}

/**
 * The locale's name in English, when that is a different word from its own.
 *
 * Null rather than a repeat: nothing renders this, so a row whose English name is the same word
 * has nothing to add. It exists so somebody looking at an interface in a script they cannot read
 * can find their language by typing the name they know.
 */
function languageNameInEnglish(locale: CrowdinLocale): string | null {
  return NAME_OVERRIDES[locale]?.english ?? LANGUAGE_NAMES_EN[locale] ?? null
}

/**
 * Whether a locale is written right to left, and therefore whether the layout mirrors.
 *
 * **The whole layout, not the text.** Text direction is the renderer's business and it handles it
 * per run; this is the separate question of which side a back chevron points, which edge an
 * input's trailing slot sits on, and which way a panel opens -- and that has one answer per
 * locale, applied once.
 */
export function isRtlLocale(locale: CrowdinLocale): boolean {
  return RTL_LOCALES.has(locale)
}

export interface LanguageOption {
  locale: CrowdinLocale
  /** The language's name in that language, which is what the row reads. */
  name: string
  /** Its name in English, where that is a different word. Searched, never drawn. */
  english: string | null
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
  .map((locale) => ({
    locale,
    name: languageName(locale),
    english: languageNameInEnglish(locale),
    flag: languageFlag(locale),
  }))
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
 * Portuguese rather than falling to European, and `zh-Hans-AU` -- what iOS reports for Simplified
 * Chinese on an Australian device -- reaches `zh-Hans` and then the table above. The catalogue has
 * no bare `zh`, so anything less than this leaves Chinese matching nothing.
 *
 * Last, a language with exactly one shipped variant matches it, so bare `hy` finds `hy-AM`. Only
 * when there is exactly one: bare `pt` could be either Portuguese.
 *
 * Null rather than English, because the caller decides what an unsupported system language does --
 * and a flag nobody chose says something untrue about the current setting.
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
