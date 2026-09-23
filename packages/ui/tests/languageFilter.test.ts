import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it('finds a language by its English name, whatever script it is written in', () => {
    // The case that was hit: typing `jap` found nothing, because the row carries only 日本語 and
    // there was nothing else to match. Somebody whose device is in English and who is looking for
    // Japanese cannot be asked to type it in Japanese.
    const rows = [
      {
        value: 'ja',
        label: '\u65e5\u672c\u8a9e',
        english: 'Japanese',
        flag: '\ud83c\uddef\ud83c\uddf5',
      },
      { value: 'de', label: 'Deutsch', english: 'German', flag: '\ud83c\udde9\ud83c\uddea' },
    ]
    expect(filterLanguages(rows, 'jap').map((r) => r.value)).toEqual(['ja'])
    expect(filterLanguages(rows, 'German').map((r) => r.value)).toEqual(['de'])
    // The other two matchers still work, and the code is why `ja` already did.
    expect(filterLanguages(rows, 'ja').map((r) => r.value)).toEqual(['ja'])
    expect(filterLanguages(rows, 'Deutsch').map((r) => r.value)).toEqual(['de'])
  })

  it('tolerates a row with no English name', () => {
    // Most of the list has one; the eight whose English name is the same word carry null rather
    // than a repeat, and `theDefault` row carries none at all.
    const rows = [{ value: 'eo', label: 'Esperanto', english: null, flag: '\ud83c\udf10' }]
    expect(filterLanguages(rows, 'esper').map((r) => r.value)).toEqual(['eo'])
    expect(filterLanguages(rows, 'zzz')).toEqual([])
  })

  it('matches a row typed in a different case', () => {
    const rows = [
      { value: 'it', label: 'Italiano', english: 'Italian', flag: '\ud83c\uddee\ud83c\uddf9' },
    ]
    expect(filterLanguages(rows, 'italiano').map((r) => r.value)).toEqual(['it'])
    expect(filterLanguages(rows, 'ITALIANO').map((r) => r.value)).toEqual(['it'])
  })
})

/**
 * That the fold does not read the device's locale.
 *
 * Asserted against the source rather than against a result, because the defect is invisible from
 * the outside on every machine this suite runs on: `toLocaleLowerCase` with no argument agrees
 * with `toLowerCase` everywhere except a Turkish or Azeri device, where it maps `I` to a dotless
 * letter and no language beginning with an I can be found by typing its name. Both are in the
 * catalogue, so those are devices somebody has.
 */
describe('the case fold', () => {
  it('is the locale-independent one', () => {
    const source = readFileSync(join(import.meta.dirname, '../src/languageFilter.ts'), 'utf8')
    const code = source.slice(source.lastIndexOf('*/') + 2)
    expect(code).not.toMatch(/toLocaleLowerCase|toLocaleUpperCase/)
  })
})
