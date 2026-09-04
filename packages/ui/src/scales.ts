import { FONT_SIZE, RADII, SPACING } from '@session/theme-tokens'

/**
 * The token scales, as plain objects.
 *
 * Apart from tamagui on purpose: a missing token resolves to 0 in silence rather than
 * failing, so something has to be able to check a `$name` against the real list — and
 * tokens.contract.test.ts is a node test that has no business loading a UI framework to
 * read four records.
 */

export const COLOR_SCALE = {
  // Deliberately almost empty: colours come from the themes, which come from
  // @session/theme-tokens. A colour token here would be one that no theme could restyle.
  transparent: 'transparent',
}

export const SPACE_SCALE = {
  // Half steps are real tokens, not decoration. A token the scale does not define resolves
  // to 0 rather than failing, so `padding="$1.5"` on a scale without a 1.5 is a silent loss
  // of padding rather than an error.
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
}

export const SIZE_SCALE = {
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
}

export const RADIUS_SCALE = {
  0: 0,
  1: RADII.sm,
  2: 10,
  3: RADII.message,
  4: 24,
  full: 9999,
  true: RADII.sm,
}

export const Z_INDEX_SCALE = { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, true: 0 }

export const FONT_SIZE_SCALE = {
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
}

export const LINE_HEIGHT_SCALE = {
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
}

export const FONT_WEIGHT_SCALE = { 4: '400', 6: '600', 7: '700', true: '400' }
export const LETTER_SPACING_SCALE = { 4: 0, true: 0 }
