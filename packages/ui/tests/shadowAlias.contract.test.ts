import { getThemeTokens } from '@session/theme-tokens'
import { describe, expect, it } from 'vitest'

import { buildThemes } from '#src/themes'

/**
 * Tamagui's own shadow names read the theme's shadow role.
 *
 * They were a hard-coded `rgba(0, 0, 0, 0.25)` in this package -- a colour outside theme-tokens,
 * and a light theme's value everywhere, so a dark theme cast a shadow a quarter as strong as the
 * one it should. Any component using Tamagui's `shadowColor` resolves through these names.
 */
describe("Tamagui's shadow names", () => {
  it('carry the theme role, and so differ between a light theme and a dark one', () => {
    const themes = buildThemes()
    for (const [theme, id] of [
      ['classicLight', 'classic-light'],
      ['classicDark', 'classic-dark'],
    ] as const) {
      const shadow = getThemeTokens(id, 'green').shadow
      for (const name of [
        'shadowColor',
        'shadowColorHover',
        'shadowColorPress',
        'shadowColorFocus',
      ])
        expect(themes[theme]?.[name]).toBe(shadow)
    }
    expect(themes['classicDark']?.['shadowColor']).not.toBe(themes['classicLight']?.['shadowColor'])
  })
})
