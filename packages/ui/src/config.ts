import { FONT_SIZE, RADII, SPACING } from '@session/theme-tokens'
import { createFont, createTamagui, createTokens } from 'tamagui'

import { buildThemes, DEFAULT_THEME, themeName } from './themes'

/**
 * The tamagui configuration, shared by both apps.
 *
 * The mobile babel plugin and the desktop build point at this same file, so a token added
 * here exists on every platform at once.
 */

const bodyFont = createFont({
  family: 'System',
  size: {
    1: FONT_SIZE.xxs,
    2: FONT_SIZE.xs,
    3: FONT_SIZE.sm,
    4: FONT_SIZE.md,
    5: FONT_SIZE.lg,
    6: FONT_SIZE.xl,
    7: FONT_SIZE.h7,
    8: FONT_SIZE.h6,
    9: FONT_SIZE.h3,
    10: FONT_SIZE.h2,
    11: FONT_SIZE.h1,
    true: FONT_SIZE.md,
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 18,
    4: 20,
    5: 24,
    6: 26,
    7: 26,
    8: 28,
    9: 32,
    10: 36,
    11: 42,
    true: 20,
  },
  weight: { 4: '400', 6: '600', 7: '700', true: '400' },
  letterSpacing: { 4: 0, true: 0 },
})

export const tokens = createTokens({
  color: {
    // Deliberately empty: colours come from the themes, which come from @session/theme-tokens.
    // A colour token here would be one that no theme could restyle.
    transparent: 'transparent',
  },
  space: {
    // Half steps are real tokens, not decoration. A token the scale does not define
    // resolves to 0 rather than failing, so `padding="$1.5"` on a scale without a 1.5 is a
    // silent loss of padding rather than an error.
    0: 0,
    0.5: SPACING.xxs,
    1: SPACING.xs,
    1.5: SPACING.sm,
    2: SPACING.md,
    2.5: SPACING.lg,
    3: SPACING.xl,
    3.5: SPACING['2xl'],
    4: SPACING['3xl'],
    true: SPACING.md,
  },
  size: {
    // Component heights, so `size="$6"` is a control that is 32 tall.
    0: 0,
    1: 8,
    2: 12,
    3: 16,
    4: 20,
    5: 24,
    6: 32,
    7: 40,
    8: 48,
    9: 56,
    10: 64,
    true: 40,
  },
  radius: {
    0: 0,
    1: RADII.sm,
    2: 10,
    3: RADII.message,
    4: 24,
    full: 9999,
    true: RADII.sm,
  },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, true: 0 },
})

export const config = createTamagui({
  fonts: { body: bodyFont, heading: bodyFont },
  tokens,
  themes: buildThemes(),
  media: {
    /**
     * Phone: one pane at a time, the router provides back.
     * gtSm: list and detail side by side — a tablet in landscape, or any desktop window.
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
