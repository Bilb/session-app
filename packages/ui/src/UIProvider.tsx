import type { PrimaryColorState, ThemeState } from '@session/theme-tokens'
import type { ReactNode } from 'react'
import { TamaguiProvider } from 'tamagui'

import { config } from './config'
// Side-effecting: puts the compiled themes in the document on the web, and does nothing on native.
// See tamaguiCSS.ts - without it every `$token` colour resolves to an undefined custom property.
import './tamaguiCSS'
import { DEFAULT_ACCENT, DEFAULT_THEME, themeName } from './themes'

export interface UIProviderProps {
  children: ReactNode
  theme?: ThemeState
  accent?: PrimaryColorState
}

/**
 * Wraps an app in the shared configuration and the theme it is currently showing.
 *
 * The theme name is resolved here rather than by the caller so that the accent
 * sub-theme convention stays inside this package.
 */
export function UIProvider({
  children,
  theme = DEFAULT_THEME,
  accent = DEFAULT_ACCENT,
}: UIProviderProps) {
  return (
    <TamaguiProvider config={config} defaultTheme={themeName(theme, accent)}>
      {children}
    </TamaguiProvider>
  )
}
