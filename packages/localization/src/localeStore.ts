import type { CrowdinLocale } from './localization-src/generated/constants'
import { setLocaleInUse } from './localization-src/localeTools'
import { matchLocale } from './languageList'

/**
 * The locale in use, and a way to hear about it changing.
 *
 * `setLocaleInUse` already exists and is what `tr()` reads, but it is a module-scope assignment:
 * nothing re-renders when it changes, so a screen that called it would keep showing the previous
 * language until something else happened to re-render it. This wraps it in the smallest thing that
 * fixes that -- a value, a setter and a subscription -- and deliberately stops there. No React:
 * this package has none, and the hook that adapts it belongs where the screens are.
 *
 * **Not persisted yet.** The only preference store the app has is libsession's globals table,
 * reached through `getPref`/`setPref`, and that needs an identity -- which is exactly what does
 * not exist while onboarding is running. So a language chosen during onboarding survives until the
 * account does, and then has somewhere to live. Choosing it again after a mid-onboarding relaunch
 * is the cost, and it is smaller than a second preference store to keep in step.
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

let current: CrowdinLocale = deviceLocale()
const listeners = new Set<() => void>()

setLocaleInUse(current)

export function getLocale(): CrowdinLocale {
  return current
}

export function setLocale(locale: CrowdinLocale): void {
  if (locale === current) return
  current = locale
  setLocaleInUse(locale)
  for (const listener of listeners) listener()
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam: puts the store back to whatever the device says, listeners and all. */
export function resetLocale(): void {
  setLocale(deviceLocale())
}
