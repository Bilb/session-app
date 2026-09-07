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

/**
 * The names tamagui's own components reach for.
 *
 * Session's vocabulary is semantic and its own - `backgroundPrimary`, `textSecondary` - and
 * tamagui's built-ins know nothing about it: they ask for `$background`, `$colorHover`,
 * `$backgroundFocus` and the rest. A name no theme defines resolves to 0 in silence, so a
 * built-in with a gap here renders an invisible border or a transparent surface and reports
 * nothing.
 *
 * Written out in full rather than added one warning at a time, because that is a game of
 * whack-a-mole against whichever component someone happens to render next. These are aliases:
 * every colour still has exactly one definition, in @session/theme-tokens.
 */
const TAMAGUI_NAMES = [
  'background',
  'backgroundHover',
  'backgroundPress',
  'backgroundFocus',
  'backgroundStrong',
  'backgroundTransparent',
  'color',
  'colorHover',
  'colorPress',
  'colorFocus',
  'colorTransparent',
  'placeholderColor',
  'borderColor',
  'borderColorHover',
  'borderColorPress',
  'borderColorFocus',
  'outlineColor',
  'shadowColor',
  'shadowColorHover',
  'shadowColorPress',
  'shadowColorFocus',
] as const

/** The list above is what must exist; this is what each one means in Session's terms. */
function tamaguiAliases(tokens: ThemeTokens): Record<(typeof TAMAGUI_NAMES)[number], string> {
  const clear = 'rgba(0, 0, 0, 0)'
  const shadow = 'rgba(0, 0, 0, 0.25)'

  return {
    background: tokens.backgroundPrimary,
    backgroundHover: tokens.backgroundSecondary,
    backgroundPress: tokens.backgroundTertiary,
    backgroundFocus: tokens.backgroundSecondary,
    backgroundStrong: tokens.backgroundPrimary,
    backgroundTransparent: clear,
    color: tokens.textPrimary,
    colorHover: tokens.textPrimary,
    colorPress: tokens.textPrimary,
    // Focus is the one that takes the accent: it is the only one of these that is meant to
    // be noticed, and it is how a keyboard user knows where they are.
    colorFocus: tokens.textPrimary,
    colorTransparent: clear,
    placeholderColor: tokens.textSecondary,
    borderColor: tokens.bordersColor,
    borderColorHover: tokens.bordersColor,
    borderColorPress: tokens.bordersColor,
    borderColorFocus: tokens.primaryColor,
    outlineColor: tokens.primaryColor,
    shadowColor: shadow,
    shadowColorHover: shadow,
    shadowColorPress: shadow,
    shadowColorFocus: shadow,
  }
}

export { TAMAGUI_NAMES }

function toTamaguiTheme(tokens: ThemeTokens): Record<string, string> {
  return {
    // Tamagui wants a flat record of colour values; ThemeTokens already is one.
    ...tokens,
    ...tamaguiAliases(tokens),
  }
}

export function buildThemes(): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {}

  // `dark` and `light` are not spare themes, they are what makes the rest of them work on the web.
  //
  // Tamagui compiles a theme into a CSS rule whose selector list it assembles from the theme names,
  // and it only starts that list for a theme literally called `dark` or `light`
  // (see getThemeCSSRules). Every name here is `classicDark`-shaped, so the list came out empty and
  // the rule with it: `, .tm_xxt { ... }`, a leading comma, which is invalid CSS that every browser
  // drops without a word. The result was a desktop app in which no `$token` colour resolved to
  // anything and every screen fell back to the browser's black on white, while believing it was
  // showing classic dark. Native never noticed: there is no CSS there, and a theme reaches a
  // component through context as resolved values.
  //
  // The two are the classic pair, which is what a base light and a base dark are here. Nothing
  // selects them by name - `themeName()` never produces one - so they cost a rule each and change
  // nothing about what the app draws.
  themes['dark'] = toTamaguiTheme(getThemeTokens('classic-dark', DEFAULT_ACCENT))
  themes['light'] = toTamaguiTheme(getThemeTokens('classic-light', DEFAULT_ACCENT))

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
