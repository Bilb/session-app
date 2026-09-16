import { I18nManager } from 'react-native'

/**
 * Mirrors the layout, or puts it back.
 *
 * The native half, and it behaves differently enough to be worth knowing. `allowRTL` is asked for
 * once because a build that has never allowed it ignores `forceRTL` entirely. `forceRTL` then
 * pins the direction to the app's own language rather than letting the OS decide from the device's
 * -- which is what we want, since the picker owns the language here.
 *
 * **It takes effect on the next launch, not on this one.** react-native reads the direction when
 * the bridge starts and lays out against that for the life of the process, so a change made now is
 * a change the next launch shows. Calling it anyway is what makes the *next* launch right, and a
 * language change already asks somebody to restart.
 */
export function applyDirection(rtl: boolean): void {
  I18nManager.allowRTL(true)
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl)
}
