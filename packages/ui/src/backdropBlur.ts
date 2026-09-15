import { createContext, useContext, type ReactNode } from 'react'

/**
 * Draws a blur over everything behind it, filling the box it is put in.
 *
 * A component rather than a set of values, because what does the blurring is a platform view --
 * `UIVisualEffectView` on iOS, nothing at all elsewhere -- and the one library that reaches it is
 * `expo-blur`, which may only be imported from `apps/mobile`. `ui` cannot import `app` either, so
 * the seam has to be here.
 */
export type BackdropBlur = () => ReactNode

const BackdropBlurContext = createContext<BackdropBlur | null>(null)

export const BackdropBlurProvider = BackdropBlurContext.Provider

/**
 * How to blur what is behind a dialog, or null where the platform does not.
 *
 * Null rather than a throw: **only iOS blurs**. Android and the desktop client darken and nothing
 * else, and a dialog that had to be told so on every platform would be carrying an iOS detail
 * everywhere. Absent is the ordinary case.
 */
export function useBackdropBlur(): BackdropBlur | null {
  return useContext(BackdropBlurContext)
}
