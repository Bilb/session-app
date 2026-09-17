import type { CrowdinLocale } from './localization-src/generated/constants'
import { setLocaleInUse } from './localization-src/localeTools'
import { matchLocale } from './languageList'

/**
 * The locale in use, and a way to hear about it changing.
 *
 * `setLocaleInUse` is what `tr()` reads, but it is a module-scope assignment: nothing re-renders
 * when it changes. This wraps it in the smallest thing that fixes that -- a value, a setter and a
 * subscription -- and stops there. No React: this package has none, and the hook that adapts it
 * belongs where the screens are.
 *
 * **Not persisted yet.** The only preference store is libsession's globals table, which needs an
 * identity -- exactly what does not exist while onboarding is running. So a language chosen during
 * onboarding survives until the account does. Choosing it again after a mid-onboarding relaunch is
 * the cost, and it is smaller than a second preference store to keep in step.
 */

const FALLBACK: CrowdinLocale = 'en'

/**
 * What the device says, as a locale the app actually ships.
 *
 * `Intl.DateTimeFormat().resolvedOptions().locale` rather than a platform API, because it is the
 * one way of asking that works on all three: Hermes ships `Intl.DateTimeFormat` even though it
 * ships almost nothing else of `Intl`, so this needs no port and no polyfill.
 */
export function deviceLocale(): CrowdinLocale {
  try {
    return matchLocale(new Intl.DateTimeFormat().resolvedOptions().locale) ?? FALLBACK
  } catch {
    return FALLBACK
  }
}

/**
 * Whether a language has been chosen here, as distinct from which one is in use.
 *
 * **Two states that look the same and are not.** Somebody following the system and somebody who
 * picked the system's language by hand are in the same language today and want different things
 * tomorrow: the first follows the device when it changes, the second does not. Without this the
 * picker cannot offer a way back, because there is nothing to go back *to*.
 *
 * It matters more on iOS than it looks, because the device's answer is not only the device's: iOS
 * hands an app its *effective* locale, so a per-app language set in Settings arrives here as the
 * device's. Following the system therefore means following whichever of those two is in force,
 * which is what somebody who set one would expect.
 */
let chosen: CrowdinLocale | null = null
let current: CrowdinLocale = deviceLocale()
const listeners = new Set<() => void>()

setLocaleInUse(current)

export function getLocale(): CrowdinLocale {
  return current
}

/** Whether the language is the device's rather than one picked here. */
export function followingSystemLocale(): boolean {
  return chosen === null
}

/**
 * Listeners are told every time, even when the language did not move.
 *
 * Switching between "the device's English" and "English, chosen" changes nothing about the
 * strings and everything about which row is ticked, and the picker reads both through the same
 * subscription.
 */
function apply(locale: CrowdinLocale): void {
  if (locale !== current) {
    current = locale
    setLocaleInUse(locale)
  }
  for (const listener of listeners) listener()
}

export function setLocale(locale: CrowdinLocale): void {
  chosen = locale
  apply(locale)
}

/**
 * Hands the choice back to the device.
 *
 * Re-read rather than remembered: the device's language can have changed since this module was
 * loaded -- on Android it can change under a running app -- and the point of following it is to
 * follow it now.
 */
export function followSystemLocale(): void {
  chosen = null
  apply(deviceLocale())
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam: puts the store back to its opening state, listeners and all. */
export function resetLocale(): void {
  followSystemLocale()
}
