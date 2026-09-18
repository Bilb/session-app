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
  // Named, the way the font scale already is: `$2` and `$3` say nothing about which gap they are,
  // and a reviewer cannot tell a deliberate step from a typo. A token the scale does not define
  // resolves to 0 rather than failing, so a name that does not exist is a silent loss of padding --
  // which is the other reason not to have people counting rungs.
  ...SPACING,
  none: 0,
  true: SPACING.md,
}

export const SIZE_SCALE = {
  // A ladder of dimensions, shared by control heights and icons, and named for the same reason the
  // other scales are: `$7` says nothing, and a reader should not have to count rungs to find out
  // that it is 40. A control's own `size="md"` is a different vocabulary -- that names a button,
  // this names a measurement, and the two deliberately do not have to agree.
  none: 0,
  xxs: 8,
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 56,
  '5xl': 64,
  true: 40,
}

export const RADIUS_SCALE = {
  // Named for the same reason the space scale is: a corner is a look rather than a position, and
  // `$3` says nothing about which one. Two of these have no name in theme-tokens, so they are
  // named here rather than by changing a file the whole app's theming rests on.
  none: 0,
  sm: RADII.sm,
  md: 10,
  lg: RADII.message,
  xl: 24,
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
