import { useFontScale } from './useFontScale'

/**
 * The text size past which glyphs beside text stop growing with it: iOS's XXX Large, the largest
 * size outside the accessibility ones. Beyond it a glyph takes width the text needs to stay on one
 * line, and the text is what carries the meaning, so the text goes on growing and the glyph holds.
 */
export const GLYPH_MAX_SCALE = 1.353

/** How much a glyph beside text grows with the system text size: with it, up to XXX Large. */
export function useGlyphScale(): number {
  return Math.min(Math.max(useFontScale(), 1), GLYPH_MAX_SCALE)
}
