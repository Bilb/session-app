import { createContext, useContext } from 'react'

/**
 * The taps a gesture gives the hand. Installed by the app, because the one library that reaches
 * the platform's engine is `expo-haptics`, which may only be imported from `apps/mobile`.
 */
export interface Haptics {
  /** A swipe crossed the point where letting go acts. */
  threshold: () => void
}

const HapticsContext = createContext<Haptics | null>(null)

export const HapticsProvider = HapticsContext.Provider

/**
 * Null where nothing taps back: the desktop client, and a test.
 * @public Read only by `.native` files, which knip does not scan.
 */
export function useHaptics(): Haptics | null {
  return useContext(HapticsContext)
}
