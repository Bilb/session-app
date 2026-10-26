/**
 * The darkest a raised surface's shadow is drawn: a tooltip, a modal panel, a toast. Dark themes
 * draw shadows in opaque black, which reads as a heavy smudge rather than a lift; light themes are
 * lighter than this already and are unchanged by it.
 */
const RAISED_SHADOW_ALPHA_MAX = 0.51

/** The theme's shadow colour, no darker than `RAISED_SHADOW_ALPHA_MAX`. */
export function raisedShadow(shadowColour: string): string {
  return shadowWithAlpha(shadowColour, (a) => Math.min(a, RAISED_SHADOW_ALPHA_MAX))
}

/**
 * A theme's shadow colour with its alpha changed by `alpha`. The shadow is an `rgba()` string in
 * every theme; anything else is treated as opaque black.
 */
export function shadowWithAlpha(shadowColour: string, alpha: (current: number) => number): string {
  const rgba = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(
    shadowColour,
  )
  const [r, g, b, a] = rgba === null ? ['0', '0', '0', '1'] : rgba.slice(1)
  return `rgba(${r}, ${g}, ${b}, ${String(alpha(Number(a)))})`
}
