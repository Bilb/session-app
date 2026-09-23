import { PRIMARY_COLOR_HEX } from '#src/colors'
import { hexToOklch, oklchToHex } from '#src/oklch'
import { CONTRAST, MIN_SEMANTIC_CHROMA, baseFits, contrastRatio } from '#src/rules'
import { deriveTokens } from '#src/themeTokens'
import type { ThemeKnobs, ThemeTokens } from '#src/themeTokens'

/**
 * How much of the knob space the rules actually hold up across.
 *
 * Enumerating it is not on: base lightness, chroma and hue, tint hue and two chromas, and seven
 * accents multiply out past twenty million. Sampling answers the same question to a tighter
 * tolerance than the question deserves -- twenty thousand draws pin a proportion to about half a
 * percent -- and runs in a second or two.
 *
 * The generator is a seeded LCG rather than `Math.random`, so a number quoted in a review is a
 * number anybody can reproduce, and a regression moves it rather than adding noise to it.
 */

const ACCENTS = Object.values(PRIMARY_COLOR_HEX)

/** Every predicate a palette owes, and what it means when one fails. */
type Check =
  | 'body text'
  | 'muted text'
  | 'accent as text'
  | 'danger legible'
  | 'warning legible'
  | 'on accent'
  | 'on danger'
  | 'bubble text'
  | 'danger distinct from text'
  | 'warning distinct from text'
  | 'surface ladder'

export type Sample = {
  knobs: ThemeKnobs
  accent: string
  fits: boolean
  failed: Check[]
}

function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return state / 0x100000000
  }
}

function failures(t: ThemeTokens): Check[] {
  const out: Check[] = []
  const surfaces = [
    t.backgroundPrimary,
    t.backgroundSecondary,
    t.backgroundTertiary,
    t.backgroundNested,
  ]
  const worst = (hex: string) => Math.min(...surfaces.map((s) => contrastRatio(hex, s)))

  // The floors are `CONTRAST`'s. A second copy would let this sampler and the sweep disagree about
  // what passing means, and the disagreement would be invisible -- both still report a percentage.
  if (worst(t.textPrimary) < CONTRAST.normal) out.push('body text')
  if (worst(t.textSecondary) < CONTRAST.normal) out.push('muted text')
  if (worst(t.accentText) < CONTRAST.normal) out.push('accent as text')
  if (worst(t.dangerColor) < CONTRAST.normal) out.push('danger legible')
  if (worst(t.warningColor) < CONTRAST.normal) out.push('warning legible')
  // On-fill colours are only ever labels, so they owe text contrast rather than the 3:1 a graphic
  // gets -- see `onAccent` in themeTokens.ts.
  if (contrastRatio(t.onAccent, t.primaryColor) < CONTRAST.normal) out.push('on accent')
  if (contrastRatio(t.onDanger, t.dangerColor) < CONTRAST.normal) out.push('on danger')
  if (contrastRatio(t.messageBubbleIncomingText, t.messageBubbleIncomingBg) < CONTRAST.normal) {
    out.push('bubble text')
  }
  // Deliberately not a check on danger-versus-warning. They may resemble each other; the words
  // beside them carry the meaning. What each owes is to be distinct from a paragraph, and since
  // text is achromatic that is a question about chroma.
  if (hexToOklch(t.dangerColor).c < MIN_SEMANTIC_CHROMA) out.push('danger distinct from text')
  if (hexToOklch(t.warningColor).c < MIN_SEMANTIC_CHROMA) out.push('warning distinct from text')

  // Each surface against *its own parent*, which is a tree and not a line. Secondary and tertiary
  // are both children of the page -- a recessed panel and a selected row -- and nested is a child of
  // secondary. Checking nested against tertiary would compare two branches rather than a step,
  // which reports a collapsed ladder on two thirds of light bases that are in fact fine.
  const steps: [string, string][] = [
    [t.backgroundSecondary, t.backgroundPrimary],
    [t.backgroundTertiary, t.backgroundPrimary],
    [t.backgroundNested, t.backgroundSecondary],
  ]
  if (steps.some(([a, b]) => contrastRatio(a, b) < 1.02)) out.push('surface ladder')

  return out
}

/** One draw from the knob space. Deliberately unconstrained -- including bases that cannot work. */
function draw(random: () => number): Sample {
  const l = random()
  const c = random() * 0.33
  const h = random() * 360
  const background = oklchToHex({ l, c, h })
  const polarity = l >= 0.5 ? 'light' : 'dark'
  const accent = ACCENTS[Math.floor(random() * ACCENTS.length)]!

  const knobs: ThemeKnobs = {
    polarity,
    background,
    tint: {
      hue: random() * 360,
      surface: random() * 0.2,
      emphasis: random() * 0.2,
    },
    elevation: '#000000',
    pathConnected: '#31F196',
    defaultAccent: accent,
  }

  return {
    knobs,
    accent,
    fits: baseFits(background, polarity),
    failed: failures(deriveTokens(knobs, accent)),
  }
}

export function sample(count: number, seed = 0x5eed): Sample[] {
  const random = lcg(seed)
  return Array.from({ length: count }, () => draw(random))
}

export type Coverage = {
  total: number
  valid: number
  fitting: number
  fittingValid: number
  byCheck: Record<string, number>
  byLightness: { band: string; valid: number; total: number }[]
}

export function coverage(samples: Sample[]): Coverage {
  const byCheck: Record<string, number> = {}
  const bands = new Map<string, { valid: number; total: number }>()
  let valid = 0
  let fitting = 0
  let fittingValid = 0

  for (const s of samples) {
    const ok = s.failed.length === 0
    if (ok) valid++
    if (s.fits) {
      fitting++
      if (ok) fittingValid++
    }
    for (const f of s.failed) byCheck[f] = (byCheck[f] ?? 0) + 1

    const l = hexToOklch(s.knobs.background).l
    const band = `${(Math.floor(l * 10) / 10).toFixed(1)}-${(Math.floor(l * 10) / 10 + 0.1).toFixed(1)}`
    const entry = bands.get(band) ?? { valid: 0, total: 0 }
    entry.total++
    if (ok) entry.valid++
    bands.set(band, entry)
  }

  return {
    total: samples.length,
    valid,
    fitting,
    fittingValid,
    byCheck,
    byLightness: [...bands.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([band, v]) => ({ band, ...v })),
  }
}

/**
 * The most chroma sRGB can actually hold at a given lightness and hue.
 *
 * Worth having as a first-class answer rather than a surprise: the ceiling varies enormously with
 * both. A yellow at mid lightness holds far more than a blue at the same lightness, and nothing
 * holds much at either end of the range. A chroma knob with a fixed maximum is therefore asking for
 * a value that is unreachable across most of its own span.
 */
export function maxChroma(l: number, h: number): number {
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const back = hexToOklch(oklchToHex({ l, c: mid, h }))
    let drift = Math.abs(back.h - h)
    if (drift > 180) drift = 360 - drift
    if (back.c >= mid * 0.98 && drift < 2) lo = mid
    else hi = mid
  }
  return lo
}
