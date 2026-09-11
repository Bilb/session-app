import { requirePorts } from '@session/app'
import { isCrowdinLocale, LANGUAGES, setLocale, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { LanguagePicker, type LanguageChoice } from '@session/ui'
import { useMemo } from 'react'

import { useLocale } from './useLocale'

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

  // Mapped once: the list is fixed for the life of the process, and the picker re-renders on every
  // keystroke of its own search box.
  const options = useMemo<LanguageChoice[]>(
    () => LANGUAGES.map(({ locale: value, name, flag }) => ({ value, label: name, flag })),
    [],
  )

  const openLanguageSettings = requirePorts().linking.openLanguageSettings

  return (
    <LanguagePicker
      value={locale}
      options={options}
      // The picker speaks in strings because that is all a generic control can take; the cast back
      // is checked rather than asserted, so a row that somehow named an unknown locale is ignored
      // instead of setting the app to a language with no catalogue behind it.
      onChange={(next) => {
        if (isCrowdinLocale(next)) setLocale(next)
      }}
      // Null where the OS has no per-app language screen, which today is everywhere -- see the
      // port. Passing it through rather than deciding here keeps the "which OS, which version"
      // question at the app edge, where the answer is known.
      //
      // `sessionSettings` is standing in for a string that does not exist yet. The catalogue has
      // the `deviceSettings*` family -- "Open Device Settings for Notifications" and so on -- and
      // no language member of it, so this branch wants a `deviceSettingsLanguage` through the
      // Crowdin pipeline before it can ship. It is unreachable until then either way.
      {...(openLanguageSettings === null
        ? {}
        : {
            onOpenSystemSettings: () => {
              void openLanguageSettings()
            },
            systemSettingsLabel: tr('sessionSettings'),
          })}
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
