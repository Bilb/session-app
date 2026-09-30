/** The weights `Text` offers, by the names callers use. */
export type WeightName = 'regular' | 'semibold' | 'bold'

/**
 * What each of `Text`'s weights asks for, in each face the body can be drawn in.
 *
 * **Roboto has no 600.** Its weights are 100, 300, 400, 500, 700 and 900, so asking for 600 gets a
 * synthesised bold -- the regular face algorithmically thickened -- which is blurrier and wider
 * than a drawn one. `semibold` is Medium there, the weight that exists between the two.
 *
 * **San Francisco's Medium is lighter than Roboto's**: 5-13% less ink at 14-18pt, a step lighter
 * than the desktop the same word is meant to match, and its Semibold is the nearest named weight
 * to Roboto's Medium. Its Regular and Bold are within a few percent of Roboto's as they are.
 * Measured at text sizes: from 20pt iOS draws SF's display cut, which runs heavier, and there its
 * Medium already matches Roboto's -- so semibold used that large would draw a step heavy.
 */
export const FACE_WEIGHTS = {
  roboto: { regular: '400', semibold: '500', bold: '700' },
  sanFrancisco: { regular: '400', semibold: '600', bold: '700' },
} as const satisfies Record<string, Record<WeightName, string>>

/** A face the body can be drawn in. */
export type Face = keyof typeof FACE_WEIGHTS

/** The key a bundled Roboto would be registered under in `FONT_ASSETS`. */
export const BODY_FAMILY_KEY = 'Roboto'

/**
 * The face the body is drawn in on a platform, given the faces the app bundles.
 *
 * The body family names Roboto first. Android has it system-wide; iOS has none and draws San
 * Francisco in its place, unless the app bundles Roboto -- which it would do through `FONT_ASSETS`.
 */
export function drawnBodyFace(os: string, bundled: Readonly<Record<string, unknown>>): Face {
  return os === 'ios' && !(BODY_FAMILY_KEY in bundled) ? 'sanFrancisco' : 'roboto'
}
