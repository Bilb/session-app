import {
  getThemeTokens,
  type PrimaryColorState,
  type ThemeState,
  type ThemeTokens,
} from '@session/theme-tokens'

/**
 * The four themes, each in seven accents, generated rather than written out.
 *
 * Tamagui's naming convention is `parent_child`, so `classicDark` is the base and
 * `classicDark_green` is that base with an accent applied. A component asks for
 * `$primaryColor` and gets whichever accent is in force; nothing has to know the list.
 *
 * The token names are the ones @session/theme-tokens already publishes. Renaming them into a
 * second vocabulary here would only create two places to keep in step, and the semantic
 * layer those tokens describe is the portable part of the design across all the clients.
 */

export const THEME_STATES: readonly ThemeState[] = [
  'classic-dark',
  'classic-light',
  'ocean-dark',
  'ocean-light',
]

export const PRIMARY_COLORS: readonly PrimaryColorState[] = [
  'green',
  'blue',
  'yellow',
  'pink',
  'purple',
  'orange',
  'red',
]

/** `classic-dark` is the name a person picked; `classicDark` is what tamagui calls it. */
export function themeName(theme: ThemeState, accent?: PrimaryColorState): string {
  const base = theme.replace(/-(.)/g, (_, c: string) => c.toUpperCase())
  return accent === undefined ? base : `${base}_${accent}`
}

export const DEFAULT_THEME: ThemeState = 'classic-dark'
export const DEFAULT_ACCENT: PrimaryColorState = 'green'

function toTamaguiTheme(tokens: ThemeTokens): Record<string, string> {
  // Tamagui wants a flat record of colour values; ThemeTokens already is one.
  return { ...tokens }
}

export function buildThemes(): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {}

  for (const theme of THEME_STATES) {
    // The base carries the default accent so a component rendered outside any sub-theme
    // still resolves $primaryColor instead of falling through to nothing.
    themes[themeName(theme)] = toTamaguiTheme(getThemeTokens(theme, DEFAULT_ACCENT))

    for (const accent of PRIMARY_COLORS) {
      themes[themeName(theme, accent)] = toTamaguiTheme(getThemeTokens(theme, accent))
    }
  }

  return themes
}
