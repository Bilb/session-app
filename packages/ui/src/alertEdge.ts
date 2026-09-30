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
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(
    shadowColour,
  )
  const [r, g, b, a] = rgba === null ? ['0', '0', '0', '1'] : rgba.slice(1)
  return `0px 0px ${String(BLUR)}px rgba(${r}, ${g}, ${b}, ${String(Number(a) * STRENGTH)})`
}
