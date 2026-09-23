import { FONT_SIZE, LINE_HEIGHT_RATIO } from '@session/theme-tokens'

/**
 * How tall a block of `lines` lines is at a given text size.
 *
 * For bounding a *view* rather than the text in it -- a scroll region that shows so many lines and
 * scrolls past that. Counted rather than measured, because a height picked in points cuts the last
 * line in half the moment the type scale or the platform's metrics move, which reads as a
 * rendering fault rather than as something to scroll.
 *
 * Here rather than in whoever needs it because the type scale is `@session/ui`'s to know: nothing
 * outside this package may reach for the tokens.
 */
export function textHeight(size: keyof typeof FONT_SIZE, lines: number): number {
  return Math.round(FONT_SIZE[size] * LINE_HEIGHT_RATIO * lines)
}

/**
 * A font size that is not on the ramp, with the line height the ramp would have given it.
 *
 * For the few places a legacy client's measurement falls between two rungs and rounding it reads as
 * a different design -- each caller names its own constant and says why. Spread onto a `Text`; a
 * bare `fontSize` would keep the line box of whichever size it replaced.
 */
export function offScaleText(fontSize: number): { fontSize: number; lineHeight: number } {
  return { fontSize, lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO) }
}
