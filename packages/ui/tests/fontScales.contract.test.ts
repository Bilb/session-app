import { describe, expect, it } from 'vitest'

import {
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  LETTER_SPACING_SCALE,
  LINE_HEIGHT_SCALE,
} from '#src/scales'

/**
 * The four font scales have to share one key set.
 *
 * Tamagui resolves `size="$label"` by looking up that key in all four at once. A scale keyed
 * differently does not error: the lookup misses, falls through to `true`, and the element quietly
 * gets the default. That is not a visible failure -- it is text at the wrong weight or with no
 * tracking, on every screen, looking deliberate.
 *
 * It had already happened. `size` and `lineHeight` were keyed by name while `weight` and
 * `letterSpacing` were keyed `{ 4, 5, 7 }`, so every piece of text in the app resolved its weight
 * through the fallback -- which is how bold inside a translated string rendered at 400.
 */
const SCALES = {
  size: FONT_SIZE_SCALE,
  lineHeight: LINE_HEIGHT_SCALE,
  weight: FONT_WEIGHT_SCALE,
  letterSpacing: LETTER_SPACING_SCALE,
}

const keysOf = (scale: object) => Object.keys(scale).sort()

describe('the font scales', () => {
  it('all carry the same keys', () => {
    const expected = keysOf(SCALES.size)
    for (const [name, scale] of Object.entries(SCALES)) {
      expect(keysOf(scale), name).toEqual(expected)
    }
  })

  it('name their positions rather than numbering them', () => {
    // The readable names are the point -- `$body` says what it is where `$4` does not. This pins
    // that they stayed readable, since the fix for the mismatch could have gone the other way.
    expect(keysOf(SCALES.size)).toContain('body')
    expect(keysOf(SCALES.size)).toContain('headingLarge')
    expect(keysOf(SCALES.size).some((key) => /^\d+$/.test(key))).toBe(false)
  })

  it('each carry a `true` default, which is what an unqualified size resolves through', () => {
    for (const [name, scale] of Object.entries(SCALES)) {
      expect(Object.keys(scale), name).toContain('true')
    }
  })
})
