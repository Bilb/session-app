import { describe, expect, it } from 'vitest'

import { PRIMARY_COLOR_HEX, type PrimaryColorState, type ThemeState } from '#src/colors'
import { CONTRAST, contrastRatio } from '#src/rules'
import { getThemeTokens } from '#src/themeTokens'

const THEMES: ThemeState[] = ['classic-light', 'classic-dark', 'ocean-light', 'ocean-dark']
const ACCENTS = Object.keys(PRIMARY_COLOR_HEX) as PrimaryColorState[]

/** The alpha of an `rgba(0, 0, 0, a)`, or null for anything that is not translucent black. */
function blackAlpha(value: string): number | null {
  const match = /^rgba\(0, 0, 0, ([0-9.]+)\)$/.exec(value)
  return match === null ? null : Number(match[1])
}

describe('the scrim and the shadow', () => {
  /**
   * The defect these replace: a backdrop drawn in a theme's own surface colour. Every dark surface
   * is lighter than its page, so that backdrop lightened the page it was meant to dim.
   */
  it('are black in every theme and accent, whatever the palette', () => {
    const wrong: string[] = []
    for (const theme of THEMES)
      for (const accent of ACCENTS) {
        const t = getThemeTokens(theme, accent)
        if (blackAlpha(t.scrim) === null) wrong.push(`${theme}/${accent} scrim ${t.scrim}`)
        if (blackAlpha(t.shadow) === null) wrong.push(`${theme}/${accent} shadow ${t.shadow}`)
      }
    expect(wrong).toEqual([])
  })

  it('are heavier on a dark theme, where there is less light to take away', () => {
    const light = getThemeTokens('classic-light', 'green')
    const dark = getThemeTokens('classic-dark', 'green')
    expect(blackAlpha(dark.scrim)).toBeGreaterThan(blackAlpha(light.scrim) ?? 1)
    expect(blackAlpha(dark.shadow)).toBeGreaterThan(blackAlpha(light.shadow) ?? 1)
  })

  it('follow polarity alone, so two themes of one polarity agree', () => {
    const classic = getThemeTokens('classic-dark', 'green')
    const ocean = getThemeTokens('ocean-dark', 'blue')
    expect(ocean.scrim).toBe(classic.scrim)
    expect(ocean.shadow).toBe(classic.shadow)
  })
})

/** An `rgba(r, g, b, a)` laid over an opaque hex, as the browser would composite it. */
function over(overlay: string, surface: string): string {
  const match = /^rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)$/.exec(overlay)
  if (match === null) throw new Error(`not an rgba: ${overlay}`)
  const [r, g, b, a] = match.slice(1).map(Number) as [number, number, number, number]
  const base = [1, 3, 5].map((at) => parseInt(surface.slice(at, at + 2), 16))
  return `#${[r, g, b]
    .map((channel, i) => Math.round(channel * a + (base[i] ?? 0) * (1 - a)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/**
 * The least a hover may move its surface. The old ghost hover on Classic Dark's recessed surface,
 * `#1B1B1B` to `#1f1f1f`, was 1.02 -- present in the numbers and invisible on screen.
 */
const MIN_HOVER_STEP = 1.05

const SURFACES = [
  'backgroundPrimary',
  'backgroundSecondary',
  'backgroundTertiary',
  'backgroundNested',
] as const

describe('the hover and pressed overlays', () => {
  /**
   * The defect these replace: hover and press drawn as surface roles, which are a fixed distance
   * from the page. On the recessed surface a dialog sits on, the hover was one shade from it and,
   * in the light themes, the press was lighter than the hover.
   */
  it('step away from every surface a control can sit on, the press further than the hover', () => {
    const wrong: string[] = []
    for (const theme of THEMES)
      for (const accent of ACCENTS) {
        const t = getThemeTokens(theme, accent)
        for (const surface of SURFACES) {
          const ground = t[surface]
          const hover = contrastRatio(ground, over(t.hoverOverlay, ground))
          const pressed = contrastRatio(ground, over(t.pressedOverlay, ground))
          if (hover < MIN_HOVER_STEP || pressed <= hover)
            wrong.push(
              `${theme}/${accent} on ${surface}: hover ${hover.toFixed(3)}, pressed ${pressed.toFixed(3)}`,
            )
        }
      }
    expect(wrong).toEqual([])
  })

  /**
   * What lets a control take one without restating its label: body text is derived to clear every
   * surface, and this holds that for a surface with a state laid over it too.
   * `Button.contract.test.ts` relies on it.
   *
   * **Muted text holds only the floor a glyph needs** while a control is hovered or held. In the
   * light themes it sits close enough to 4.5 on the bare surfaces that a darker ground takes it under,
   * and holding it there would mean darkening muted text on every screen for a state that lasts as
   * long as a press. No control draws its label in it; what it colours on a control is an icon.
   */
  it('leave body text readable, and muted glyphs visible, on every surface they cover', () => {
    const wrong: string[] = []
    for (const theme of THEMES)
      for (const accent of ACCENTS) {
        const t = getThemeTokens(theme, accent)
        for (const surface of SURFACES)
          for (const overlay of [t.hoverOverlay, t.pressedOverlay])
            for (const [text, floor] of [
              ['textPrimary', CONTRAST.normal],
              ['textSecondary', CONTRAST.ui],
            ] as const) {
              const ratio = contrastRatio(t[text], over(overlay, t[surface]))
              if (ratio < floor)
                wrong.push(`${theme}/${accent} ${text} on ${surface}: ${ratio.toFixed(2)}`)
            }
      }
    expect(wrong).toEqual([])
  })
})
