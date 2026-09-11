import { getLocale, subscribeLocale, type CrowdinLocale } from '@session/localization'
import { useSyncExternalStore } from 'react'

/**
 * The language in use, re-rendering whoever asks when it changes.
 *
 * `tr()` reads a module-scope variable, which is the right shape for a function called from
 * anywhere but means nothing re-renders when the language changes. This is the adapter between
 * that and React, and it lives here rather than in `@session/localization` because that package
 * has no React and should not grow one for a six-line hook.
 *
 * `useSyncExternalStore` rather than an effect and a state: the language can change between a
 * render and the effect that would have subscribed, and this is the API that exists to close that
 * gap. The third argument is the server snapshot, which never runs here -- neither app server-side
 * renders -- but omitting it makes the hook throw under any renderer that does.
 */
export function useLocale(): CrowdinLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale)
}
