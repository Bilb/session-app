import { describe, expect, it } from 'vitest'

import { filterLanguages } from '#src/languageFilter'
import type { LanguageChoice } from '#src/LanguagePicker.types'

/**
 * The filter rather than the picker, because this package has no renderer: the picker is tamagui
 * and a react-native `Modal`, and standing either up in node would be testing the toolchain. The
 * filter is where a person's typing meets the list, and it is the part that can be wrong.
 */
const OPTIONS: LanguageChoice[] = [
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'pt-BR', label: 'português (Brasil)', flag: '🇧🇷' },
  { value: 'pt-PT', label: 'português (Portugal)', flag: '🇵🇹' },
  { value: 'tr', label: 'Türkçe', flag: '🇹🇷' },
]

describe('filtering the language list', () => {
  it('returns everything for an empty search', () => {
    expect(filterLanguages(OPTIONS, '')).toEqual(OPTIONS)
    expect(filterLanguages(OPTIONS, '   ')).toEqual(OPTIONS)
  })

  it('matches the name as written', () => {
    expect(filterLanguages(OPTIONS, 'deuts').map((o) => o.value)).toEqual(['de'])
  })

  it('matches the locale code, which is the only handle on a language you cannot read', () => {
    // Somebody who has landed in an interface they cannot read types the code they know. Without
    // this, the way out of a mis-picked language is to recognise its name in its own script.
    expect(filterLanguages(OPTIONS, 'de').map((o) => o.value)).toEqual(['de'])
    expect(filterLanguages(OPTIONS, 'pt-').map((o) => o.value)).toEqual(['pt-BR', 'pt-PT'])
  })

  it('ignores case', () => {
    expect(filterLanguages(OPTIONS, 'ENGLISH').map((o) => o.value)).toEqual(['en'])
  })

  it('lower-cases by locale, not by ASCII', () => {
    // `'TÜRKÇE'.toLowerCase()` gives `türkçe` in a JS engine's default casing, which is what this
    // relies on; the point of the test is that the non-ASCII letters survive the fold at all.
    expect(filterLanguages(OPTIONS, 'TÜRKÇE').map((o) => o.value)).toEqual(['tr'])
  })

  it('returns nothing rather than everything when nothing matches', () => {
    // The empty list is what puts the "no languages found" message on screen; falling back to the
    // full list would silently ignore the search instead.
    expect(filterLanguages(OPTIONS, 'zzz')).toEqual([])
  })
})
