import { FONT_SIZE } from '@session/theme-tokens'

type RampSize = keyof typeof FONT_SIZE

/** The largest rung of the type ramp no bigger than `px`, for a size derived from something else. */
export function rampSizeAtMost(px: number): RampSize {
  const fitting = (Object.keys(FONT_SIZE) as RampSize[]).filter((key) => FONT_SIZE[key] <= px)
  return fitting.reduce((best, key) => (FONT_SIZE[key] > FONT_SIZE[best] ? key : best), 'caption')
}
