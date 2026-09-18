import { createFont, createTamagui, createTokens } from 'tamagui'

import {
  COLOR_SCALE,
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  LETTER_SPACING_SCALE,
  LINE_HEIGHT_SCALE,
  RADIUS_SCALE,
  SIZE_SCALE,
  SPACE_SCALE,
  Z_INDEX_SCALE,
} from './scales'
import { buildThemes, DEFAULT_THEME, themeName } from './themes'

/**
 * The tamagui configuration, shared by both apps.
 *
 * The mobile babel plugin and the desktop build point at this same file, so a token added
 * here exists on every platform at once.
 */

const bodyFont = createFont({
  /**
   * A stack ending in a generic family, because `System` is react-native's name and not a CSS one:
   * on the web it names nothing and the engine falls back, which in Electron is a serif. Roboto
   * leads it as the desktop client's face, and only takes effect where it is installed -- shipping
   * the faces is a separate question.
   */
  family: 'Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  size: FONT_SIZE_SCALE,
  lineHeight: LINE_HEIGHT_SCALE,
  weight: FONT_WEIGHT_SCALE,
  letterSpacing: LETTER_SPACING_SCALE,
})

export const tokens = createTokens({
  color: COLOR_SCALE,
  space: SPACE_SCALE,
  size: SIZE_SCALE,
  radius: RADIUS_SCALE,
  zIndex: Z_INDEX_SCALE,
})

export const config = createTamagui({
  fonts: { body: bodyFont, heading: bodyFont },
  tokens,
  themes: buildThemes(),
  media: {
    /**
     * Phone: one pane at a time, the router provides back.
     * gtSm: list and detail side by side - a tablet in landscape, or any desktop window.
     * gtLg: the same, with room for a wider list.
     *
     * These are used, not decorative: AdaptiveShell reads them, and it is the only place
     * that decides how many panes are on screen.
     */
    sm: { maxWidth: 700 },
    gtSm: { minWidth: 701 },
    gtLg: { minWidth: 1100 },
  },
  settings: {
    // Without this, a bare `fontSize="$md"` resolves against the *space* scale instead of the
    // font scale -- both have an `md` -- and the text comes out at a spacing value.
    defaultFont: 'body',
    onlyAllowShorthands: false,
  },
  defaultTheme: themeName(DEFAULT_THEME),
})

export type AppConfig = typeof config

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
