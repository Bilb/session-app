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
  /** A theme-coloured backdrop would lighten a dark page: every dark surface is lighter. */
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

/** The least a hover may move its surface; 1.02 passes the numbers but is invisible on screen. */
const MIN_HOVER_STEP = 1.05

const SURFACES = [
  'backgroundPrimary',
  'backgroundSecondary',
  'backgroundTertiary',
  'backgroundNested',
] as const

describe('the hover and pressed overlays', () => {
  /**
   * Surface roles are a fixed distance from the page, so on a dialog's recessed ground a
   * surface-role hover barely shows and, in the light themes, the press is lighter than the hover.
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
   * Lets a control take an overlay without restating its label; `Button.contract.test.ts` relies
   * on it. Muted text only needs the glyph floor: in the light themes it sits near 4.5 on bare
   * surfaces, and no control draws a label in it, only icons.
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
