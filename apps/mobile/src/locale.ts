import { matchLocale, setLocale } from '@session/localization'
import { NativeModules, Platform } from 'react-native'

/**
 * The language the OS has chosen **for this app**, which is not the same question as the device's.
 *
 * `deviceLocale()` in the localization package asks `Intl.DateTimeFormat`, which is the one way of
 * asking that works on all three platforms and needs no port. What it answers with is the device's
 * locale -- region included -- and a per-app language override does not move it: somebody who sets
 * Session to Chinese on an otherwise-English phone is still told `en-AU`.
 *
 * iOS records that override as `AppleLanguages` in the app's own defaults, which is what
 * `SettingsManager` reports; Android's equivalent reaches `I18nManager.localeIdentifier`. Both are
 * in react-native itself, so this needs no native code of its own -- and it lives here rather than
 * in the localization package for the usual reason: that package has no react-native and should
 * not grow one.
 *
 * Startup only. Once somebody picks a language in the app, that choice is theirs and this does not
 * run again.
 */
function preferredLanguage(): string | null {
  if (Platform.OS === 'ios') {
    const settings = (
      NativeModules as Record<string, { settings?: { AppleLanguages?: unknown } } | undefined>
    )['SettingsManager']?.settings
    const languages = settings?.AppleLanguages
    if (!Array.isArray(languages)) return null
    const first: unknown = languages[0]
    return typeof first === 'string' ? first : null
  }
  const identifier = (NativeModules as Record<string, { localeIdentifier?: unknown } | undefined>)[
    'I18nManager'
  ]?.localeIdentifier
  return typeof identifier === 'string' ? identifier : null
}

const preferred = preferredLanguage()
const matched = preferred === null ? null : matchLocale(preferred)
// Only when it names a language we ship. Anything else leaves the Intl answer in place, which is
// already the right fallback rather than a worse one.
if (matched !== null && matched !== undefined) setLocale(matched)
