import { createContext, useContext, type ReactNode } from 'react'

/**
 * A round glass button's surface, as iOS 26 draws its bar buttons. Injected because
 * `expo-glass-effect` may only be imported from `apps/mobile`.
 */
export interface GlassProps {
  /** The diameter. */
  size: number
  /** Whether the app is showing a dark theme, which the platform's own appearance may not match. */
  dark: boolean
  children: ReactNode
}

export type Glass = (props: GlassProps) => ReactNode

const GlassContext = createContext<Glass | null>(null)

export const GlassProvider = GlassContext.Provider

/** Null where the platform has no glass (iOS before 26, Android, desktop). */
export function useGlass(): Glass | null {
  return useContext(GlassContext)
}
