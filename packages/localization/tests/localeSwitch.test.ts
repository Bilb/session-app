import { beforeEach, describe, expect, it } from 'vitest'

import { getLocale, setLocale } from '#src/localeStore'
import { tr } from '#src/localization-src/localeTools'

/**
 * Choosing a language changes the strings, which is the whole of what the picker is for.
 *
 * Asserted because it silently did not: `getSimpleStringNoArgs` falls back to English for a locale
 * it has no table for, so a catalogue that failed to reach the app looks exactly like a language
 * that has not been chosen -- the flag beside the picker updates, every string stays English, and
 * nothing anywhere says why.
 */
describe('choosing a language', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('changes what tr returns', () => {
    const english = tr('theContinue')
    setLocale('ar')
    expect(getLocale()).toBe('ar')
    const arabic = tr('theContinue')
    expect(arabic).not.toBe(english)
    // Arabic script, so the answer is not English wearing a different label.
    expect(arabic).toMatch(/[؀-ۿ]/)
  })

  it('carries a right-to-left locale for every script we ship one for', () => {
    for (const locale of ['ar', 'he', 'fa', 'ur'] as const) {
      setLocale(locale)
      expect(tr('theContinue'), `${locale} has no translation`).not.toBe('Continue')
    }
  })
})
