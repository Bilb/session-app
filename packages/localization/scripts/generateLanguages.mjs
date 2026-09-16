// Generates src/generated/languages.ts: per-locale data a picker needs and the runtime cannot work
// out for itself -- each locale's name written in its own language, and the region CLDR associates
// with it.
//
// It exists because **Hermes has almost no `Intl`**. Verified against the Hermes that ships with
// this React Native (0.17, build 250829098) by reading its string table: the `Intl` object carries
// `Collator`, `DateTimeFormat`, `NumberFormat`, `getCanonicalLocales` and `supportedLocalesOf`, and
// nothing else. Neither `Intl.DisplayNames` (the names) nor `Intl.Locale` (the regions) is there.
// So the runtime that most needs this data is the one that cannot compute it.
//
// Node can, though, given a full-ICU build, which is what this uses. Right tool, wrong runtime:
// the fix is to run it at build time and ship the answer.
//
// The alternative is the `@formatjs` polyfills, which are the usual choice on React Native. They
// are the wrong shape here: they ship every language's name in every locale, plus region and
// script names, and a picker needs one cell of that matrix -- each language's name in its own
// language. Eighty strings against several megabytes.
//
// Run with `pnpm --filter @session/localization codegen`. CI runs `codegen:check`, which
// regenerates and fails on a diff, so a locale added upstream cannot arrive without its data.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')

const constants = readFileSync(join(pkg, 'src/localization-src/generated/constants.ts'), 'utf8')
const block = constants.slice(constants.indexOf('export const crowdinLocales'))
// The region subtag can be numeric -- `es-419` is Latin American Spanish -- so this is not
// letters-only. A letters-only pattern silently dropped it, and the typecheck caught it as a
// missing key rather than it shipping as a blank row.
const locales = [
  ...new Set([...block.matchAll(/'([a-z]{2,3}(?:-[A-Za-z0-9]+)?)'/g)].map((m) => m[1])),
]

if (locales.length === 0) {
  throw new Error('No locales found in constants.ts — has the generated file moved?')
}

if (typeof Intl.DisplayNames !== 'function' || typeof Intl.Locale !== 'function') {
  throw new Error('This node lacks Intl.DisplayNames or Intl.Locale; a full-ICU build is required.')
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
// The second name each row carries: what the language is called in English, so somebody whose
// interface is in a language they cannot read can still find their own by typing it.
const englishNames = new Intl.DisplayNames(['en'], { type: 'language' })

/**
 * The region CLDR associates with a locale, or null when there is no country to name.
 *
 * Three ways that happens, and all three are real entries in the Crowdin list rather than edge
 * cases invented here: a constructed language maximizes to `001` (World); `es-419` maximizes to
 * `419` (Latin America), a UN region; and `sr-SP` maximizes to `SP`, which is two letters but not
 * an assigned ISO 3166-1 code -- Serbia is `RS`. The last one only shows up as a flag of two
 * letter tiles, so it is checked rather than trusted: ICU echoes a code back when it has no name
 * for it, which is the same "that is not an answer" test used for the language names below.
 */
function regionFor(locale) {
  let region
  try {
    region = new Intl.Locale(locale).maximize().region
  } catch {
    return null
  }
  if (!region || !/^[A-Z]{2}$/.test(region)) return null
  return regionNames.of(region) === region ? null : region
}

const names = {}
const english = {}
const regions = {}
const unresolved = []
for (const locale of locales) {
  let name
  try {
    name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale)
  } catch {
    name = undefined
  }
  // ICU echoes the code back when it has no name for it, which is not an answer.
  if (!name || name === locale) unresolved.push(locale)
  else names[locale] = name
  // No `unresolved` check here: an English name that echoes the code is a row you can still find
  // by its code or its own name, which is not the blank row the endonym would leave.
  let inEnglish
  try {
    inEnglish = englishNames.of(locale)
  } catch {
    inEnglish = undefined
  }
  if (inEnglish && inEnglish !== locale && inEnglish !== name) english[locale] = inEnglish
  regions[locale] = regionFor(locale)
}

if (unresolved.length > 0) {
  // Loud rather than silent: a locale with no name would render as a blank row in the picker, and
  // the fix (a hand-written entry) has to be a decision somebody makes.
  throw new Error(
    `No display name for: ${unresolved.join(', ')}. Add an override before regenerating.`,
  )
}

const byCode = (a, b) => a[0].localeCompare(b[0])

const nameEntries = Object.entries(names)
  .sort(byCode)
  .map(([code, name]) => `  '${code}': ${JSON.stringify(name)},`)
  .join('\n')

const englishEntries = Object.entries(english)
  .sort(byCode)
  .map(([code, name]) => `  '${code}': ${JSON.stringify(name)},`)
  .join('\n')

const regionEntries = Object.entries(regions)
  .sort(byCode)
  .map(([code, region]) => `  '${code}': ${region === null ? 'null' : `'${region}'`},`)
  .join('\n')

const out = `// Generated by scripts/generateLanguages.mjs. Do not edit by hand.
//
// Per-locale data for the language picker, generated because Hermes ships almost no \`Intl\`:
// neither \`Intl.DisplayNames\` nor \`Intl.Locale\` exists there. Regenerate with
// \`pnpm --filter @session/localization codegen\`.

import type { CrowdinLocale } from '../localization-src/generated/constants'

/** Each locale's name in its own language, so a picker renders "Français" rather than "fr". */
export const LANGUAGE_NAMES: Record<CrowdinLocale, string> = {
${nameEntries}
}

/**
 * Each locale's name in English, where that differs from its own.
 *
 * Partial by design: a row whose English name is the same word carries nothing here. Nothing
 * renders this -- it is there so a search for "japanese" finds 日本語.
 */
export const LANGUAGE_NAMES_EN: Partial<Record<CrowdinLocale, string>> = {
${englishEntries}
}

/**
 * The region CLDR associates with each locale, or null where there is no country to name.
 *
 * Inferred for most of them -- the Crowdin list states a region for only a handful -- so this
 * says "where is this language mostly spoken", not "this language belongs to this country".
 * \`languageFlag\` is where that distinction is handled.
 */
export const LANGUAGE_REGIONS: Record<CrowdinLocale, string | null> = {
${regionEntries}
}
`

mkdirSync(join(pkg, 'src/generated'), { recursive: true })
writeFileSync(join(pkg, 'src/generated/languages.ts'), out)
// Formatted here rather than left for `format:check` to fail on, since generated output has to be
// committed in the shape the repo expects.
execFileSync('pnpm', ['exec', 'prettier', '--write', 'src/generated/languages.ts'], {
  cwd: pkg,
  stdio: 'ignore',
})

const withRegion = Object.values(regions).filter((r) => r !== null).length
process.stdout.write(
  `generated ${locales.length} locales; ${withRegion} with a region, ${locales.length - withRegion} without\n`,
)
