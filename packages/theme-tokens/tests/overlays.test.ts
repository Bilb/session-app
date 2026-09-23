import { describe, expect, it } from 'vitest'

import { PRIMARY_COLOR_HEX, type PrimaryColorState, type ThemeState } from '#src/colors'
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
