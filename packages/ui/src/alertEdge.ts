/**
 * An alert's edge: the desktop and Android clients' border, which still shows in a dark theme where
 * a shadow cannot. The shadow is the iOS client's (`Modal.swift`: radius 10 at 0.4), as one
 * `boxShadow` because the separate shadow props render differently per platform and cannot scale a
 * theme variable on the web.
 */
export const ALERT_BORDER = { borderWidth: 1, borderColor: '$bordersColor' } as const

/** A CALayer's shadow radius as a CSS blur, which is twice it. */
const BLUR = 20
const STRENGTH = 0.4

/** The alert's shadow: the theme's shadow colour at the iOS client's strength. */
export function alertShadow(shadowColour: string): string {
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(
    shadowColour,
  )
  const [r, g, b, a] = rgba === null ? ['0', '0', '0', '1'] : rgba.slice(1)
  return `0px 0px ${String(BLUR)}px rgba(${r}, ${g}, ${b}, ${String(Number(a) * STRENGTH)})`
}
