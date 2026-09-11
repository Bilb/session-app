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
  // Roboto, which is what the desktop client uses. Shipped with the app rather than assumed -- see
  // tamaguiCSS.ts, which declares the faces on the web. The fallbacks matter: Android has Roboto
  // system-wide, iOS does not, and a stack that ends in `sans-serif` is what stops an unlinked
  // font resolving to a serif.
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
    // Without this, `fontSize="$4"` resolves against the *space* scale instead of the font
    // scale, and every piece of text comes out at a spacing value.
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
