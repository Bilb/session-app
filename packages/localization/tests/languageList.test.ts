import { describe, expect, it } from 'vitest'

import { crowdinLocales } from '#src/localization-src/generated/constants'
import { LANGUAGE_NAMES, LANGUAGE_REGIONS } from '#src/generated/languages'
import { LANGUAGES, languageFlag, languageName, matchLocale, NO_FLAG } from '#src/languageList'

/**
 * The tables exist because Hermes ships neither `Intl.DisplayNames` nor `Intl.Locale`, so a picker
 * cannot work any of this out at runtime on mobile. That makes staleness the failure mode worth
 * guarding: a locale added upstream has no name and no flag until someone regenerates.
 */
describe('language names', () => {
  it('covers every locale the app ships', () => {
    const missing = crowdinLocales.filter((l) => !(l in LANGUAGE_NAMES))
    expect(missing).toEqual([])
  })

  it('names each language in its own language, not in English', () => {
    // The whole point of the table: a picker shows people their language as they write it.
    expect(languageName('fr')).toBe('français')
    expect(languageName('ja')).toBe('日本語')
    expect(languageName('ar')).toBe('العربية')
    expect(languageName('es-419')).toBe('español latinoamericano')
  })

  it('never renders a blank row', () => {
    for (const locale of crowdinLocales) {
      expect(languageName(locale).trim().length, locale).toBeGreaterThan(0)
    }
  })

  it('includes the numeric-region locale a letters-only pattern drops', () => {
    // `es-419` was missed by the first generator and caught by the typecheck rather than by eye.
    expect(LANGUAGE_NAMES['es-419']).toBeTruthy()
  })
})

describe('language flags', () => {
  it('covers every locale the app ships', () => {
    const missing = crowdinLocales.filter((l) => !(l in LANGUAGE_REGIONS))
    expect(missing).toEqual([])
  })

  it('draws a real flag where the language has a country', () => {
    expect(languageFlag('fr')).toBe('🇫🇷')
    expect(languageFlag('ja')).toBe('🇯🇵')
    // Stated by the locale rather than inferred, and the two must not collapse to one flag.
    expect(languageFlag('pt-BR')).toBe('🇧🇷')
    expect(languageFlag('pt-PT')).toBe('🇵🇹')
  })

  it('falls back to the globe for the three locales with no country', () => {
    // `001` (World) and `419` (Latin America) are regions, not countries. `SP` is two letters but
    // not an assigned ISO code -- Serbia is `RS` -- so it would render as letter tiles.
    expect(languageFlag('eo')).toBe(NO_FLAG)
    expect(languageFlag('es-419')).toBe(NO_FLAG)
    expect(languageFlag('sr-SP')).toBe(NO_FLAG)
  })

  it('emits a flag or the globe and never a raw region code', () => {
    for (const locale of crowdinLocales) {
      const flag = languageFlag(locale)
      // A flag is a pair of regional indicators; anything else here would have shipped as text.
      const isFlag = [...flag].every((ch) => {
        const code = ch.codePointAt(0) ?? 0
        return code >= 0x1f1e6 && code <= 0x1f1ff
      })
      expect(isFlag || flag === NO_FLAG, `${locale} -> ${flag}`).toBe(true)
    }
  })
})

describe('the picker list', () => {
  it('has a row for every locale', () => {
    expect(LANGUAGES).toHaveLength(crowdinLocales.length)
  })

  it('is ordered by the name as written, not by locale code', () => {
    const names = LANGUAGES.map((l) => l.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})

describe('matching a device language tag', () => {
  it('prefers the whole tag over its base', () => {
    // Otherwise `pt-BR` silently becomes European Portuguese, which is a different list entry.
    expect(matchLocale('pt-BR')).toBe('pt-BR')
  })

  it('falls back to the base language when the region is not shipped', () => {
    expect(matchLocale('fr-CA')).toBe('fr')
  })

  it('returns null rather than guessing English', () => {
    expect(matchLocale('zz')).toBeNull()
  })

  it('resolves Chinese by script, which is how every platform reports it', () => {
    // The catalogue names Chinese by region, every platform reports it by script, and there is no
    // bare `zh` to fall back to -- so this matched nothing and the app stayed in English for
    // anybody whose language was Chinese. `zh-Hans-AU` is what iOS reports when the app's language
    // is Simplified Chinese on an Australian device.
    expect(matchLocale('zh-Hans')).toBe('zh-CN')
    expect(matchLocale('zh-Hant')).toBe('zh-TW')
    expect(matchLocale('zh-Hans-AU')).toBe('zh-CN')
    expect(matchLocale('zh-Hant-TW')).toBe('zh-TW')
  })

  it('truncates one subtag at a time rather than jumping to the base', () => {
    expect(matchLocale('pt-BR-u-ca-gregory')).toBe('pt-BR')
  })

  it('takes a language with exactly one shipped variant', () => {
    expect(matchLocale('hy')).toBe('hy-AM')
  })

  it('refuses to choose between two variants of the same language', () => {
    // `pt` could be either Portuguese. Picking one would be inventing an answer the tag did not
    // give, and the caller has a better fallback than a guess.
    expect(matchLocale('pt')).toBeNull()
    expect(matchLocale('zh')).toBeNull()
  })
})
