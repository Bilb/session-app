import { describe, expect, it } from 'vitest'

import { crowdinLocales } from '../src/localization-src/generated/constants'
import { LANGUAGE_NAMES, languageName } from '../src/generated/languageNames'

/**
 * The table exists because Hermes has no `Intl.DisplayNames`, so a picker cannot compute these at
 * runtime on mobile. That makes staleness the failure mode worth guarding: a locale added upstream
 * has no name until someone regenerates.
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
