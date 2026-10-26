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
