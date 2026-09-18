import { FONT_SIZE, LINE_HEIGHT_RATIO, RADII, SPACING } from '@session/theme-tokens'

/**
 * The token scales, as plain objects.
 *
 * Apart from tamagui on purpose: a missing token resolves to 0 in silence rather than
 * failing, so something has to be able to check a `$name` against the real list - and
 * tokens.contract.test.ts is a node test that has no business loading a UI framework to
 * read four records.
 */

export const COLOR_SCALE = {
  // Deliberately almost empty: colours come from the themes, which come from
  // @session/theme-tokens. A colour token here would be one that no theme could restyle.
  transparent: 'transparent',
}

export const SPACE_SCALE = {
  // Fractional steps are real tokens, not decoration. A token the scale does not define resolves
  // to 0 rather than failing, so `padding="$1.5"` on a scale without a 1.5 is a silent loss
  // of padding rather than an error.
  //
  // Positions, not values: the numbers here name rungs on the ladder and carry no size of their
  // own, so `$2` is "the fourth rung" and what that measures is `SPACING`'s to say.
  0: 0,
  0.25: SPACING['3xs'],
  0.5: SPACING['2xs'],
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
  ...FONT_SIZE,
  // Tamagui resolves an unqualified size through `true`, so it has to name a position rather than
  // a value of its own -- one that is not in the ramp would be a twelfth size nothing declared.
  true: FONT_SIZE.body,
}

// Derived, not a second ladder to keep in step. The old one was hand-written and had already
// drifted: it repeated 26 at positions 6 and 7 where the sizes differed.
export const LINE_HEIGHT_SCALE = {
  ...(Object.fromEntries(
    Object.entries(FONT_SIZE).map(([k, v]) => [k, Math.round(v * LINE_HEIGHT_RATIO)]),
  ) as Record<keyof typeof FONT_SIZE, number>),
  true: Math.round(FONT_SIZE.body * LINE_HEIGHT_RATIO),
}

export const FONT_WEIGHT_SCALE = { 4: '400', 6: '600', 7: '700', true: '400' }
export const LETTER_SPACING_SCALE = { 4: 0, true: 0 }
