import { isRtlLocale } from '@session/localization'
import { applyDirection } from '@session/ui'

import { useLocale } from './useLocale'

/**
 * Which way the app reads, following the chosen language.
 *
 * Called at each app's root, and the answer handed to `DirectionRoot` -- which is what mirrors
 * the tree on a device. The web root can ignore the return: `applyDirection` mirrors the document
 * there on its own.
 *
 * Here rather than in `@session/ui` because the direction is a fact about the *locale*, and that
 * package has no catalogue; and not in `@session/localization`, which has no React and should not
 * grow one.
 */
export function useTextDirection(): boolean {
  const rtl = isRtlLocale(useLocale())
  // Applied while rendering rather than in an effect, because the things that ask `isLayoutRtl()`
  // -- the pager, the tab indicator, the back chevron -- render below this one in the same pass.
  // An effect runs after they have already rendered, so each language change would draw them once
  // against the previous direction. The write is idempotent and derived from nothing but the
  // locale, so a render React discards writes exactly what the committed one would have.
  applyDirection(rtl)
  return rtl
}
