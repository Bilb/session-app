import { hexToOklch, oklchToHex, relativeLuminance } from './oklch'

/**
 * The rules a theme is derived with.
 *
 * A theme authors a handful of anchors and everything else is computed from them, so adding a
 * theme is a handful of colours rather than seventy-two, and a colour a *user* picks gets the same
 * treatment as one we shipped.
 *
 * The invariant every rule here obeys: **a derived value is defined relative to what it sits on,
 * never as an absolute step in a fixed direction.** A signed step has no headroom at the ends of
 * the range -- "10% lighter" on white is white, which is how a ghost button's hover state becomes
 * invisible on a light theme -- while a step *away from* its anchor always has somewhere to go.
 */

/** How much lighter or darker one step is, in OKLCh L. */
const STEP = 0.06

/**
 * The least a step may differ from what it sits on.
 *
 * OKLCh's L is perceptually uniform but the contrast *ratio* is not linear in it: near black, a
 * step of 0.06 L moves luminance so little that the result is 1.006 against the original -- a
 * surface nobody could see the edge of. So a step guarantees separation rather than a distance.
 *
 * 1.05 because that is what the shipped themes already treat as distinct: their adjacent surfaces
 * run 1.053 (classic-light's page against its cards) to 1.251, so the floor is the tightest pair a
 * designer has already signed off rather than a number chosen here.
 */
const MIN_SEPARATION = 1.05

/** WCAG AA for body text. `large` is the allowance for text at 18pt+ or 14pt bold. */
export const CONTRAST = { normal: 4.5, large: 3, ui: 3 } as const

/**
 * The contrast ratio between two colours, 1 (identical) to 21 (black on white).
 *
 * Reported rather than only enforced: a user may pick an accent that reads poorly, and the app
 * should be able to say so rather than silently refuse or silently allow.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Whichever candidate reads best against `against`.
 *
 * This is what decides a label on a filled button, and it is why the designs put black text on the
 * salmon accent and white on a dark surface without anyone choosing per theme.
 */
export function contrastPick(candidates: readonly string[], against: string): string {
  let best = candidates[0]!
  let bestRatio = -1
  for (const c of candidates) {
    const r = contrastRatio(c, against)
    if (r > bestRatio) {
      bestRatio = r
      best = c
    }
  }
  return best
}

/**
 * The requested colour, with chroma reduced until the hue survives the trip through sRGB.
 *
 * Asking for a chroma the gamut cannot hold at that lightness does not fail, it *clamps* -- and
 * clamping RGB moves the hue. Darkening the warning amber for a light-mid base walked its hue from
 * 57 degrees to 29, which is the danger red's hue, and then to black. A desaturated amber is still
 * an amber; a red-black is a different colour wearing the same name.
 */
function inGamut(l: number, c: number, h: number): string {
  if (holdsHue(l, c, h)) return oklchToHex({ l, c, h })

  // The gamut boundary is monotonic in chroma at a fixed lightness and hue, so this bisects rather
  // than walking down in steps. It is the innermost call in every lightness search -- the coverage
  // sampler makes tens of millions of them -- and stepping made that a minute where this makes it
  // seconds.
  let lo = 0
  let hi = c
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    if (holdsHue(l, mid, h)) lo = mid
    else hi = mid
  }
  return oklchToHex({ l, c: lo, h })
}

/** Whether sRGB can hold this chroma at this lightness without the clamp dragging the hue off. */
function holdsHue(l: number, c: number, h: number): boolean {
  if (c <= 0) return true
  const back = hexToOklch(oklchToHex({ l, c, h }))
  let drift = Math.abs(back.h - h)
  if (drift > 180) drift = 360 - drift
  return drift < 4
}

/**
 * The candidate with the best *worst-case* contrast across every surface.
 *
 * `contrastPick` maximises against one colour, which is the wrong question when the thing being
 * coloured appears on a page, a card and a nested card.
 */
export function contrastPickAll(candidates: readonly string[], against: readonly string[]): string {
  const worst = (hex: string) => Math.min(...against.map((a) => contrastRatio(hex, a)))
  return candidates.reduce((best, c) => (worst(c) > worst(best) ? c : best), candidates[0]!)
}

/**
 * The first candidate that clears `min`, falling back to the highest-contrast one.
 *
 * Different from `contrastPick`, which always takes the most contrast: a brand accent is not ours
 * to recolour, so accent-as-text is a *choice between* the accent and the body text rather than an
 * adjustment of the accent. Preference order carries that -- take the accent where it is legible,
 * take the text where it is not, and never invent a third green.
 */
export function contrastPrefer(
  candidates: readonly string[],
  against: string,
  min: number,
): string {
  for (const candidate of candidates) if (contrastRatio(candidate, against) >= min) return candidate
  return contrastPick(candidates, against)
}

/**
 * `colour`, moved just far enough in lightness to reach `min` contrast against `against`.
 *
 * Keeps hue and chroma, so a brand red stays that red rather than becoming a computed colour
 * nobody chose -- which is what makes this usable for `danger` and for an accent used as text.
 * Moves *away* from the anchor, so it always has headroom, and gives up at the end of the range
 * rather than looping: a caller that cannot reach the ratio gets the closest it could manage, and
 * `contrastRatio` will say so.
 */
export function contrastAdjust(colour: string, against: string, min: number): string {
  if (contrastRatio(colour, against) >= min) return colour

  const { l, c, h } = hexToOklch(colour)
  const anchorL = hexToOklch(against).l
  const direction = anchorL < 0.5 ? 1 : -1

  let best = colour
  for (let i = 1; i <= 100; i++) {
    const next = inGamut(Math.min(1, Math.max(0, l + direction * i * 0.01)), c, h)
    best = next
    if (contrastRatio(next, against) >= min) return next
  }
  return best
}

/**
 * How much of a semantic colour's chroma has to survive any lightness search.
 *
 * A lightness search given only a contrast target will happily return white or black, because
 * those satisfy it perfectly. This is what stops it: the amber squeezed for the last of its
 * contrast on a saturated base came back `#fdfdfd`, scoring 4.56:1 and invisible.
 */
const CHROMA_KEEP = 0.6

/**
 * How much chroma a semantic colour must keep to read as one rather than as a paragraph.
 *
 * Danger and warning are not required to be separable from *each other* -- that rule cost more than
 * it bought. On a light base 4.5:1 pins both into a narrow band of lightness, so separating them
 * meant driving one of them dark, and whichever yielded lost its colour: the warning became a brown
 * that read as body text, which is the failure that actually matters.
 *
 * What they owe is distinctness from text, and text is achromatic, so chroma is what carries it.
 * They may resemble each other; neither may resemble a paragraph.
 *
 * This is also what the standard asks. WCAG 1.4.1 forbids colour as the *sole* carrier of meaning,
 * and these are sentences -- "Do not share your recovery password", "Delete account" -- which say
 * what they mean in words. A red-green colour-blind viewer reading either loses nothing. A bare
 * status dot would be a different question.
 */
export const MIN_SEMANTIC_CHROMA = 0.08

/**
 * The first candidate clearing `min` against *every* surface, else the best of them.
 *
 * `contrastPrefer` against the base alone is not enough for the same reason nothing else is: an
 * accent link legible on the page can fail on a card two steps up.
 */
export function contrastPreferAll(
  candidates: readonly string[],
  against: readonly string[],
  min: number,
): string {
  const worst = (hex: string) => Math.min(...against.map((a) => contrastRatio(hex, a)))
  for (const candidate of candidates) if (worst(candidate) >= min) return candidate
  return candidates.reduce((best, c) => (worst(c) > worst(best) ? c : best), candidates[0]!)
}

/**
 * Lifts `colour` until it clears `min` against *every* surface it might be drawn on.
 *
 * A semantic colour is not owned by the page: the warning on Link New Device is measured against
 * the page but rendered inside a card, and adjusting it against the page alone made it vanish on
 * the card.
 *
 * That defect has now appeared five times -- the message bubble derived from the page while sitting
 * on the thread, the ghost button with no headroom on white, the warning, muted text at 3.9:1 on a
 * feature-row description, and body text picked against the base while the surfaces went the other
 * way. Any new role should assume it will be drawn on a card until proven otherwise.
 *
 * When no lightness clears every surface, the best available is returned: that is a signal about
 * the *base*, not about this colour, and `baseFits` is what detects it.
 */
export function contrastAdjustAll(colour: string, against: readonly string[], min: number): string {
  const { l, c, h } = hexToOklch(colour)
  const worst = (hex: string) => Math.min(...against.map((a) => contrastRatio(hex, a)))
  const floor = c * CHROMA_KEEP

  let best = colour
  let bestWorst = worst(colour)
  for (let i = 0; i <= 100; i++) {
    for (const direction of [1, -1]) {
      const candidate = inGamut(Math.min(1, Math.max(0, l + direction * i * 0.01)), c, h)
      // A colour that has lost its chroma has lost its meaning, however well it scores. Squeezing
      // the last of the contrast out of an amber on a hostile base drove it to #fdfdfd -- 4.56:1,
      // and white. A recognisable amber at less contrast beats an invisible one at more.
      if (hexToOklch(candidate).c < floor) continue
      const w = worst(candidate)
      if (w > bestWorst) {
        best = candidate
        bestWorst = w
      }
      if (bestWorst >= min) return best
    }
  }
  return best
}

/**
 * Whether a base can support a palette at all.
 *
 * The whole ladder assumes the base sits near one end of the lightness range: every surface steps
 * *away* from it in one direction, and text steps away in the other. Hand it a mid-tone and there
 * is no lightness left on either side -- the surfaces pile up at one extreme while the base stays
 * in the middle, so no single semantic colour can clear its floor on both the base and its own
 * cards. That is not a bug in any one rule; it is the base being outside what a base can be.
 *
 * So this is a precondition, not a preference, and the honest thing for a picker to do with a
 * mid-tone is say so rather than emit a palette that cannot work.
 *
 * The two limits are measured, not guessed, and they are not symmetric. Walking neutral greys, the
 * dark end stops working between L 0.26 and L 0.28: at 0.26 the danger and warning pair still
 * separates by 0.160 lightness, and by 0.28 it is down to 0.101, inside the range where a red-green
 * colour-blind viewer loses it. The light end is far more forgiving -- still separating by 0.152 at
 * L 0.76 -- because on a light base the surfaces step *down*, leaving semantic colours the whole
 * dark half of the range to work in, where a dark base pushes them up into a ceiling.
 *
 * 0.82 on the light side is therefore conservative rather than tight. It is kept because a light
 * base much below it drives the warning toward a dark brown that stops reading as a caution, which
 * is a separate complaint from the one this function measures.
 */
export function baseFits(background: string, polarity: 'light' | 'dark'): boolean {
  const { l, c } = hexToOklch(background)
  if (c > MAX_BASE_CHROMA) return false
  return polarity === 'light' ? l >= 0.82 : l <= 0.27
}

/**
 * How saturated a base can be and still carry a palette.
 *
 * Lightness was the only term here until a sweep of the knob space measured the other one. Validity
 * falls off steadily with base chroma, and 0.12 is the knee: capping there lifts the pass rate
 * among admitted bases from 90% to 93% while still admitting three quarters of them. Above it the
 * returns flatten and the colours stop being backgrounds -- a page at chroma 0.23 is a brand colour
 * someone has typed into the wrong box.
 */
const MAX_BASE_CHROMA = 0.12

/**
 * `colour`, moved `n` steps away from `awayFrom`.
 *
 * The direction is the anchor's, not the caller's: lighter on a dark anchor, darker on a light one.
 * That is what makes one definition work in both light and dark themes, and what stops a hover
 * state disappearing at either end of the range.
 */
export function step(colour: string, n: number, awayFrom: string): string {
  const { l, c, h } = hexToOklch(colour)
  const direction = hexToOklch(awayFrom).l < 0.5 ? 1 : -1
  const move = (by: number) => oklchToHex({ l: Math.min(1, Math.max(0, l + direction * by)), c, h })

  let out = move(n * STEP)
  // Keep going until the result is far enough from where it started to be seen. This is what
  // rescues the ends of the range, where a fixed distance in L stops meaning a visible difference.
  for (let extra = 1; extra <= 60 && contrastRatio(out, colour) < MIN_SEPARATION; extra++) {
    out = move(n * STEP + extra * 0.01)
  }
  return out
}

/**
 * `colour` kept at its lightness but carrying a different hue and chroma.
 *
 * What a theme's identity is made of. Deriving a surface moves lightness only, so it inherits the
 * chroma of whatever it came from -- and a near-white background has almost none, which turns every
 * derived surface grey. Ocean's shipped surfaces carry chroma 0.026 at hue 278 in dark and 0.014 at
 * hue 202 in light, so a derivation that drops it produces a theme that is no longer Ocean.
 */
export function tint(colour: string, chroma: number, hue: number): string {
  // Through `inGamut`, never straight to hex: a chroma sRGB cannot hold at this lightness clamps,
  // and the clamp drags the hue with it, so a theme asking for an olive-tinted text gets a brown.
  return inGamut(hexToOklch(colour).l, chroma, hue)
}

/**
 * Body text carrying the theme's chroma, at a lightness that keeps it legible.
 *
 * Text is contrast-first: the default is black or white, whichever the base admits, and that needs
 * no authored colour at all. A theme whose text is part of its identity -- Ocean Light's navy --
 * asks for a chroma instead.
 *
 * A pole cannot be tinted in place, because black at chroma 0.09 is still black: no chroma exists
 * at L zero. Nor can the lightness be the first one where that chroma is merely *reachable* -- that
 * lands at L 0.10 and produces a near-black navy. So the tint is allowed to spend a fixed fraction
 * of the pole's own contrast, which self-scales: from black on a white page it gives 12.6:1, which
 * is what Ocean Light ships, and from white on a dark page it gives 9:1.
 */
const TINT_CONTRAST_SHARE = 0.6

export function tintedPole(pole: string, chroma: number, hue: number, against: string): string {
  if (chroma <= 0) return pole
  const target = contrastRatio(pole, against) * TINT_CONTRAST_SHARE
  // Seeded mid-range so `contrastTo` keeps it on the pole's side of the surface.
  return contrastTo(oklchToHex({ l: 0.5, c: chroma, h: hue }), against, target)
}

/**
 * A surface's chroma raised to the theme's floor, at the theme's hue.
 *
 * Only surfaces come through here, which is what makes the hue unconditional: the tint knob exists
 * to say what colour the surfaces are, so a base with chroma of its own must not be able to veto
 * it. Text is a different question and is answered in `dim`, where a colour that carries hue keeps
 * its own -- that is the rule that stops a navy muted text turning teal, and it does not belong
 * here.
 *
 * `max` rather than a conditional is the point. Gating the hue change on whether the chroma needed
 * lifting put a 238-degree discontinuity on a knife edge: a vivid red base sitting a ten-thousandth
 * under the floor failed the comparison by that hair and had its hue replaced, so the page was red
 * and every surface on it was blue. Applying the hue always is continuous, and continuous is what
 * a knob has to be.
 */
export function tintFloor(colour: string, minChroma: number, hue: number): string {
  const { l, c } = hexToOklch(colour)
  return inGamut(l, Math.max(c, minChroma), hue)
}

/**
 * Moves `colour` to sit at `target` contrast from `against`, in either direction.
 *
 * Distinct from `contrastAdjust`, which only ever raises: a muted text is derived by *reducing* a
 * body text's contrast, and a floor cannot do that. The search stays on whichever side of the
 * anchor the colour started, so dimming white text on a dark ground can never overshoot into
 * darker-than-the-ground.
 */
export function contrastTo(colour: string, against: string, target: number): string {
  const { l, c, h } = hexToOklch(colour)
  const anchorL = hexToOklch(against).l
  const lighter = l >= anchorL

  let best = colour
  let bestError = Math.abs(contrastRatio(colour, against) - target)
  for (let i = 0; i <= 500; i++) {
    const candidate = i / 500
    if (lighter ? candidate < anchorL : candidate > anchorL) continue
    const hex = inGamut(candidate, c, h)
    const error = Math.abs(contrastRatio(hex, against) - target)
    if (error < bestError) {
      best = hex
      bestError = error
    }
  }
  return best
}
