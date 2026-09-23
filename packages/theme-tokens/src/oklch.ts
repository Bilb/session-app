/**
 * sRGB <-> OKLCh, and WCAG relative luminance.
 *
 * Implemented rather than depended on: theme-tokens has no runtime dependencies and is the lowest
 * package in the boundary graph, so a colour library here would be one every app carries. The
 * transform is a fixed set of constants that has not changed since it was published, and the tests
 * pin it against known values.
 *
 * OKLCh rather than HSL because the rules step lightness, and HSL's lightness is not perceptual: a
 * 50% yellow reads far brighter than a 50% blue, so "one step darker" would mean different amounts
 * on different hues. OKLCh's L is perceptually uniform, which is what makes one ramp definition
 * work across every accent a user might pick.
 */

export type Oklch = { l: number; c: number; h: number }

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Throws rather than improvising, and here rather than at a caller.
 *
 * Five digits look like six to anything that slices by position, so the colour that comes out is
 * valid, different and indistinguishable from the one meant. Every colour passes through this,
 * where `knobsFor` and `deriveTokens` are public and oblige nobody to check first.
 */
function parseHex(hex: string): [number, number, number] {
  const body = hex.startsWith('#') ? hex.slice(1) : hex
  const full = body.length === 3 ? [...body].map((ch) => ch + ch).join('') : body
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a colour: ${JSON.stringify(hex)}. Expected #rgb or #rrggbb.`)
  }
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ]
}

const toHex = (n: number) =>
  Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, '0')

/** sRGB is gamma-encoded; every calculation below needs it linear first. */
const linearise = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gammaEncode = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

export function hexToOklch(hex: string): Oklch {
  const [sr, sg, sb] = parseHex(hex)
  const r = linearise(sr)
  const g = linearise(sg)
  const b = linearise(sb)

  // Linear sRGB -> LMS -> cube root -> OKLab.
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const h = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h }
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180
  const A = c * Math.cos(rad)
  const B = c * Math.sin(rad)

  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3

  const r = gammaEncode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)
  const g = gammaEncode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)
  const b = gammaEncode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * WCAG relative luminance, which is a different quantity from OKLCh's L and not interchangeable
 * with it: this one is what the contrast ratio is defined in terms of, so contrast has to use it
 * even though the stepping uses OKLCh.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearise) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
