import { requirePorts } from '@session/app'
import { isCrowdinLocale, LANGUAGES, setLocale, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, LanguagePicker, Modal, type LanguageChoice } from '@session/ui'
import { useMemo, useState } from 'react'

import { LocalizedText } from './LocalizedText'
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
  /**
   * Asked before leaving, because leaving is the whole of what this does.
   *
   * The in-app picker changes the language in front of you and can be changed back. Handing over
   * to the OS puts somebody in another app, in a list of every language their device has, and on
   * iOS the change relaunches this one -- so the tap that starts it is worth confirming, in the
   * same shape the FAQ and website links here already use for leaving.
   */
  const [confirming, setConfirming] = useState(false)

  // Mapped once: the list is fixed for the life of the process, and the picker re-renders on every
  // keystroke of its own search box.
  const options = useMemo<LanguageChoice[]>(
    () => LANGUAGES.map(({ locale: value, name, flag }) => ({ value, label: name, flag })),
    [],
  )

  const openLanguageSettings = requirePorts().linking.openLanguageSettings

  return (
    <>
      <LanguagePicker
        value={locale}
        options={options}
        // The picker speaks in strings because that is all a generic control can take; the cast back
        // is checked rather than asserted, so a row that somehow named an unknown locale is ignored
        // instead of setting the app to a language with no catalogue behind it.
        onChange={(next) => {
          if (isCrowdinLocale(next)) setLocale(next)
        }}
        // Null where the OS has no per-app language screen -- see the port. Passing it through
        // rather than deciding here keeps the "which OS, which version" question at the app edge,
        // where the answer is known.
        //
        // Opening is confirmed rather than immediate, so what the picker gets here raises the
        // question and the answer is what leaves.
        {...(openLanguageSettings === null
          ? {}
          : {
              onOpenSystemSettings: () => {
                setConfirming(true)
              },
              systemSettingsLabel: tr('openSettings'),
            })}
        accessibilityLabel={tr('appearanceLanguage')}
        title={tr('appearanceLanguage')}
        searchPlaceholder={tr('search')}
        emptyLabel={tr('searchMatchesNone')}
        closeLabel={tr('close')}
        compact
        testIDs={ELEMENT.languagePicker}
      />

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false)
        }}
        title={tr('appearanceLanguage')}
        closeLabel={tr('cancel')}
        testID={ELEMENT.languagePicker.confirmSettings}
        closeTestID={ELEMENT.languagePicker.confirmSettingsCancel}
        actions={
          <Button
            variant="ghost"
            testID={ELEMENT.languagePicker.confirmSettingsOpen}
            onPress={() => {
              setConfirming(false)
              if (openLanguageSettings !== null) void openLanguageSettings()
            }}
          >
            {tr('openSettings')}
          </Button>
        }
      >
        {/* The catalogue's own description of the setting. It is written for the in-app picker and
            it is still true of the OS one -- what it explains is that the language applies to
            Session and that changing it restarts the app, both of which hold either way. */}
        <LocalizedText text={tr('appearanceLanguageDescription')} />
      </Modal>
    </>
  )
}
