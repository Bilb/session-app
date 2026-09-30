/**
 * What separates an alert from the page behind it, on every platform: a one-pixel border and a
 * shadow.
 *
 * The border is the desktop and Android clients' edge, and it is what still shows in a dark theme,
 * where a shadow is black on near-black. The shadow is the iOS client's (`Modal.swift`: radius 10
 * at 0.4), drawn as one `boxShadow` so every platform renders the same one -- the separate shadow
 * props come out as different shadows on each, and on the web the opacity cannot scale a theme
 * variable at all.
 */
export const ALERT_BORDER = { borderWidth: 1, borderColor: '$bordersColor' } as const

/** A CALayer's shadow radius as a CSS blur, which is twice it. */
const BLUR = 20
const STRENGTH = 0.4

/**
 * The alert's shadow, from the theme's shadow colour: opaque black in the dark themes and a quarter
 * black in the light ones, each at the iOS client's strength.
 */
export function alertShadow(shadowColour: string): string {
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(
    shadowColour,
  )
  const [r, g, b, a] = rgba === null ? ['0', '0', '0', '1'] : rgba.slice(1)
  return `0px 0px ${String(BLUR)}px rgba(${r}, ${g}, ${b}, ${String(Number(a) * STRENGTH)})`
}
