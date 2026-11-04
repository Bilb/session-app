import { describe, expect, it } from 'vitest'
import { hexToOklch, oklchToHex, relativeLuminance } from '#src/oklch'
import { baseFits, contrastAdjust, contrastPick, contrastRatio, step, tint } from '#src/rules'
import { deriveTokens, getThemeKnobs, getThemeTokens } from '#src/themeTokens'

describe('oklch', () => {
  it('round-trips the extremes and a mid grey', () => {
    for (const hex of ['#000000', '#ffffff', '#808080', '#31f196', '#ff9c8e']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })

  it('puts black and white at the ends of L', () => {
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 5)
    expect(hexToOklch('#ffffff').l).toBeCloseTo(1, 5)
  })

  it('is perceptual where HSL is not: equal-L hues have similar luminance', () => {
    // The whole reason for OKLCh. In HSL, `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)`
    // (blue) share a lightness while differing ~20x in luminance. At equal OKLCh L they do not.
    const yellow = oklchToHex({ l: 0.7, c: 0.12, h: 100 })
    const blue = oklchToHex({ l: 0.7, c: 0.12, h: 260 })
    const ratio = relativeLuminance(yellow) / relativeLuminance(blue)
    expect(ratio).toBeGreaterThan(0.6)
    expect(ratio).toBeLessThan(1.7)
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG anchors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('does not care which way round the arguments go', () => {
    expect(contrastRatio('#31f196', '#1b1b1b')).toBeCloseTo(contrastRatio('#1b1b1b', '#31f196'), 10)
  })
})

describe('contrastPick', () => {
  it('puts black on the light accents and white on the dark surfaces', () => {
    // Both of these are decisions the designs make by hand today: black on the salmon accent,
    // white on a dark bubble.
    expect(contrastPick(['#000000', '#ffffff'], '#ff9c8e')).toBe('#000000')
    expect(contrastPick(['#000000', '#ffffff'], '#31f196')).toBe('#000000')
    expect(contrastPick(['#000000', '#ffffff'], '#1b1b1b')).toBe('#ffffff')
  })
})

describe('contrastAdjust', () => {
  it('leaves a colour alone when it already passes', () => {
    expect(contrastAdjust('#000000', '#ffffff', 4.5)).toBe('#000000')
  })

  it('rescues an accent used as text on its own background', () => {
    // The `accentText` case, and the one a light accent breaks first: green on white is 1.5:1.
    const green = '#31f196'
    const onWhite = contrastAdjust(green, '#ffffff', 4.5)
    expect(contrastRatio(green, '#ffffff')).toBeLessThan(4.5)
    expect(contrastRatio(onWhite, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the hue, so a brand red stays that red', () => {
    const red = '#e12d19'
    const fixed = contrastAdjust(red, '#ffffff', 4.5)
    expect(Math.abs(hexToOklch(fixed).h - hexToOklch(red).h)).toBeLessThan(2)
  })
})

describe('step', () => {
  it('goes lighter on a dark anchor and darker on a light one', () => {
    expect(hexToOklch(step('#1b1b1b', 1, '#000000')).l).toBeGreaterThan(hexToOklch('#1b1b1b').l)
    expect(hexToOklch(step('#f0f0f0', 1, '#ffffff')).l).toBeLessThan(hexToOklch('#f0f0f0').l)
  })

  it('has headroom at both ends -- the ghost-button case', () => {
    // A text-only button on a white page: a signed "+10% lightness" hover is white on white and
    // invisible. Stepping away from the surface always lands somewhere visible, and "visible" is
    // the tightest separation the shipped themes already use.
    for (const surface of ['#ffffff', '#000000', '#1b1b1b', '#fcffff']) {
      expect(contrastRatio(step(surface, 1, surface), surface)).toBeGreaterThanOrEqual(1.05)
    }
  })

  it('separates each surface level from the one below it', () => {
    const bg = '#1b1b1b'
    const raised = step(bg, 1, bg)
    const overlay = step(raised, 1, bg)
    expect(hexToOklch(raised).l).toBeGreaterThan(hexToOklch(bg).l)
    expect(hexToOklch(overlay).l).toBeGreaterThan(hexToOklch(raised).l)
  })
})

/**
 * `colour` at `a` opacity, as `#rrggbbaa`.
 *
 * Here rather than in `rules.ts` because no token carries alpha yet. The format is the part worth
 * keeping: eight-digit hex means every token is one string in one shape, which is what lets the
 * contract test check them all the same way -- so a scrim or overlay token that arrives later
 * should move this back rather than reach for `rgba()`.
 *
 * Eight-digit hex rather than `rgba()` so every token stays one string in one format, which is what
 * lets the contract test check them all the same way.
 */
function alpha(colour: string, a: number): string {
  const hex = colour.length === 4 ? colour.replace(/[^#]/g, (ch) => ch + ch) : colour
  return `${hex.slice(0, 7)}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`
}

/**
 * That a tint keeps the hue it was asked for.
 *
 * Nothing else in the suite looks at hue -- the sweep and the coverage sampler both ask only about
 * contrast and chroma -- so a colour arriving at the wrong hue passes every other assertion. The
 * yellow-green band at low lightness is where sRGB is tightest and the drift is largest, which
 * makes it the case worth pinning.
 */
describe('tint', () => {
  it('reduces chroma rather than letting the clamp move the hue', () => {
    const asked = 110
    const tinted = tint('#2a2a2a', 0.18, asked)
    const got = hexToOklch(tinted)

    // Four degrees is the tolerance `holdsHue` enforces. Beyond it the result is a different
    // colour family rather than a shade of the one asked for: a clamp here reaches 96.7.
    expect(Math.abs(got.h - asked)).toBeLessThan(4)
    expect(got.c).toBeLessThan(0.18)
  })

  it('leaves a chroma the gamut can hold alone', () => {
    // Ocean Light's navy text is this shape, which is why no shipped theme moved.
    const tinted = tint('#2a2a2a', 0.09, 278)
    const got = hexToOklch(tinted)
    expect(got.c).toBeCloseTo(0.09, 2)
    expect(got.h).toBeCloseTo(278, 0)
  })
})

describe('alpha', () => {
  it('appends the byte and clamps', () => {
    expect(alpha('#31f196', 1)).toBe('#31f196ff')
    expect(alpha('#31f196', 0)).toBe('#31f19600')
    expect(alpha('#31f196', 0.5)).toBe('#31f19680')
    expect(alpha('#31f196', 2)).toBe('#31f196ff')
  })
})

/** `surface` under an `rgba(...)` overlay, flattened. */
function held(surface: string, overlay: string): string {
  const [r, g, b, a] = overlay.match(/[\d.]+/g)!.map(Number)
  const under = [1, 3, 5].map((i) => parseInt(surface.slice(i, i + 2), 16))
  return `#${[r, g, b]
    .map((c, i) => Math.round(c! * a! + under[i]! * (1 - a!)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

describe('semantic colours', () => {
  it('keeps danger and warning saturated enough to read as warnings', () => {
    // They are permitted to resemble each other. What neither may be is a colour so dull it reads
    // as body text -- which the derived warning was, at chroma 0.074, before the pair-separation
    // rule was dropped.
    for (const theme of ['classic-dark', 'classic-light', 'ocean-dark', 'ocean-light'] as const) {
      const { semantic: _authored, ...knobs } = getThemeKnobs(theme)
      const { dangerColor, warningColor } = deriveTokens(knobs, '#31F196')
      expect(hexToOklch(warningColor).c).toBeGreaterThan(0.12)
      expect(hexToOklch(dangerColor).c).toBeGreaterThan(0.12)
    }
  })

  it('records that the shipped reds do not clear text contrast on their own cards', () => {
    // Not a failure to fix: the presets author these because they are recognisable, and this is
    // the cost of that choice, pinned so it cannot change unnoticed.
    const shortfalls: string[] = []
    for (const theme of ['classic-dark', 'classic-light', 'ocean-dark', 'ocean-light'] as const) {
      const t = getThemeTokens(theme, 'green')
      for (const surface of [t.backgroundTertiary, t.backgroundNested]) {
        if (contrastRatio(t.dangerColor, surface) < 4.5) shortfalls.push(`${theme} danger`)
      }
    }
    expect(shortfalls.length).toBeGreaterThan(0)
  })

  it('draws danger as text legibly on every surface, authored red or not', () => {
    for (const theme of ['classic-dark', 'classic-light', 'ocean-dark', 'ocean-light'] as const) {
      const t = getThemeTokens(theme, 'green')
      for (const surface of [
        t.backgroundPrimary,
        t.backgroundSecondary,
        t.backgroundTertiary,
        t.backgroundNested,
      ]) {
        expect(contrastRatio(t.dangerText, surface)).toBeGreaterThanOrEqual(4.5)
      }
      // A destructive row is held on the page or on a card.
      for (const surface of [t.backgroundPrimary, t.backgroundSecondary]) {
        const under = held(surface, t.pressedOverlay)
        expect(contrastRatio(t.dangerText, under)).toBeGreaterThanOrEqual(4.5)
      }
      // A failure's retry glyph keeps the red on a received bubble, and a glyph owes 3:1.
      expect(contrastRatio(t.dangerText, t.messageBubbleIncomingBg)).toBeGreaterThanOrEqual(3)
      // Red on the incoming bubble only where it is legible there, the bubble's text elsewhere.
      expect(
        contrastRatio(t.messageBubbleIncomingDanger, t.messageBubbleIncomingBg),
      ).toBeGreaterThanOrEqual(4.5)
      expect([t.dangerText, t.messageBubbleIncomingText]).toContain(t.messageBubbleIncomingDanger)
      // A danger button's label, at rest on its fill and held on the pressed one.
      expect(contrastRatio(t.onDanger, t.dangerColor)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.onDanger, t.dangerPressed)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps a DERIVED semantic colour legible on every surface, not just the page', () => {
    // The warning is measured against the page but rendered inside a card, and adjusting it
    // against the page alone made it disappear on the card.
    //
    // Derived rather than as-shipped, because all four presets author their reds and ambers and
    // those authored values do not meet this -- see the test below, which is the finding rather
    // than a failure.
    for (const theme of ['classic-dark', 'classic-light', 'ocean-dark', 'ocean-light'] as const) {
      const { semantic: _authored, ...knobs } = getThemeKnobs(theme)
      const t = deriveTokens(knobs, '#31F196')
      const surfaces = [
        t.backgroundPrimary,
        t.backgroundSecondary,
        t.backgroundTertiary,
        t.backgroundNested,
      ]
      for (const surface of surfaces) {
        expect(contrastRatio(t.dangerColor, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(t.warningColor, surface)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('rejects a base with no headroom on either side', () => {
    // A mid-tone base is not a valid base: the surfaces pile up at one extreme while the base stays
    // in the middle, so no semantic colour can clear its floor on both.
    expect(baseFits('#FFFFFF', 'light')).toBe(true)
    expect(baseFits('#1B1B1B', 'dark')).toBe(true)
    expect(baseFits('#A45A41', 'dark')).toBe(false)
    expect(baseFits('#A45A41', 'light')).toBe(false)
    expect(baseFits('#9AA1CB', 'dark')).toBe(false)
  })
})
