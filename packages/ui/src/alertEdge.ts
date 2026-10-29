import { shadowWithAlpha } from './shadowColour'

/**
 * An alert's edge is a border and a shadow together. The border is what still separates it in a
 * dark theme, where the shadow barely shows. The shadow is one `boxShadow` because the separate
 * shadow props render differently per platform and cannot scale a theme variable on the web.
 */
export const ALERT_BORDER = { borderWidth: 1, borderColor: '$bordersColor' } as const

const BLUR = 20
const STRENGTH = 0.4

/** The alert's shadow: the theme's shadow colour at `STRENGTH`, blurred by `BLUR`. */
export function alertShadow(shadowColour: string): string {
  return `0px 0px ${String(BLUR)}px ${shadowWithAlpha(shadowColour, (a) => a * STRENGTH)}`
}
