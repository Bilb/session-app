import { createContext, useContext, type ReactNode } from 'react'

/**
 * A round glass button's surface, as iOS 26 draws the buttons in its own bars.
 *
 * A component for the reason `BackdropBlur` is one: the glass is a platform view, and the library
 * that reaches it is `expo-glass-effect`, which may only be imported from `apps/mobile`.
 */
export interface GlassProps {
  /** The diameter. */
  size: number
  /** Whether the app is showing a dark theme, which the platform's own appearance may not match. */
  dark: boolean
  /** What sits on the glass -- a glyph. */
  children: ReactNode
}

export type Glass = (props: GlassProps) => ReactNode

const GlassContext = createContext<Glass | null>(null)

export const GlassProvider = GlassContext.Provider

/**
 * How to draw a glass button, or null where the platform has no glass -- iOS before 26, Android
 * and the desktop client, which keep their own controls.
 */
export function useGlass(): Glass | null {
  return useContext(GlassContext)
}
