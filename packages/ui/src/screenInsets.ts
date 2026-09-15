import type { ScreenInsets } from './screenInsets.types'

export type { ScreenInsets }

/**
 * What the hardware takes out of the window, which on the web is nothing.
 *
 * A window has no notch and no home indicator, so this is zero everywhere and exists only so that
 * shared code can ask without knowing which platform it is on.
 */
export function useScreenInsets(): ScreenInsets {
  return { top: 0, right: 0, bottom: 0, left: 0 }
}
