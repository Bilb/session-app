import {
  deviceLocale,
  followSystemLocale,
  isCrowdinLocale,
  languageFlag,
  languageOptions,
  setLocale,
  tr,
} from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { LanguagePicker, type LanguageChoice } from '@session/ui'
import { useMemo } from 'react'

import { SYSTEM_LOCALE, useLocale, useLocaleChoice } from './useLocale'

/**
 * The language control, wired to the app's catalogue.
 *
 * `@session/ui` cannot import `@session/localization` -- a component that knows the string
 * catalogue is one only this app can use -- so the picker takes its rows and its labels as props
 * and this is where they come from.
 *
 * Its own component rather than part of a screen because it belongs on more than one: onboarding
 * needs it before an account exists, and appearance settings needs the same control afterwards.
 */
export function LanguageButton() {
  const locale = useLocale()
  const ticked = useLocaleChoice()
  /**
   * The row that hands the choice back to the device, above the languages themselves.
   *
   * **It carries the flag of whatever the device resolves to**, which is the whole reason it can
   * say so little: the word says that the language is not ours to decide and the flag says which
   * one that currently means. "Default" is iOS's own vocabulary for it -- its per-app Language
   * screen labels the system choice exactly that.
   *
   * Without this row there is no way back. Picking the system's own language by hand looks
   * identical today and behaves differently tomorrow, when the device changes and a chosen
   * language does not follow it.
   */
  const system = deviceLocale()

  // The languages are fixed for the life of the process; the row above them is not, because the
  // device's answer can change. The picker re-renders on every keystroke of its own search box, so
  // neither is rebuilt for that.
  const options = useMemo<LanguageChoice[]>(
    () => [
      { value: SYSTEM_LOCALE, label: tr('theDefault'), flag: languageFlag(system) },
      ...languageOptions.map(({ locale: value, name, english, flag }) => ({
        value,
        label: name,
        english,
        flag,
      })),
    ],
    [system, locale],
  )

  return (
    <LanguagePicker
      value={ticked}
      options={options}
      // The picker speaks in strings because that is all a generic control can take; the cast back
      // is checked rather than asserted, so a row that somehow named an unknown locale is ignored
      // instead of setting the app to a language with no catalogue behind it.
      onChange={(next) => {
        if (next === SYSTEM_LOCALE) followSystemLocale()
        else if (isCrowdinLocale(next)) setLocale(next)
      }}
      accessibilityLabel={tr('appearanceLanguage')}
      title={tr('appearanceLanguage')}
      searchPlaceholder={tr('search')}
      emptyLabel={tr('searchMatchesNone')}
      closeLabel={tr('close')}
      compact
      testIDs={ELEMENT.languagePicker}
    />
  )
}
