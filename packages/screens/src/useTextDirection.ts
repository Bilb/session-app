import { getLocale, isRtlLocale, subscribeLocale } from '@session/localization'
import { applyDirection } from '@session/ui'
import { useEffect } from 'react'

/**
 * Keeps the layout's direction following the chosen language.
 *
 * Called once at each app's root. It is a subscription rather than a render-time call because the
 * language can change while the app is running and the direction has to change with it -- and
 * because the two platforms apply it differently: the web mirrors immediately, native pins it for
 * the next launch. See `textDirection.ts` and its native half.
 *
 * Here rather than in `@session/ui` because the direction is a fact about the *locale*, and that
 * package has no catalogue; and not in `@session/localization`, which has no React and should not
 * grow one.
 */
export function useTextDirection(): void {
  useEffect(() => {
    applyDirection(isRtlLocale(getLocale()))
    return subscribeLocale(() => {
      applyDirection(isRtlLocale(getLocale()))
    })
  }, [])
}
