import { getThemeTokens } from '@session/theme-tokens'
import { describe, expect, it } from 'vitest'

import { buildThemes } from '#src/themes'

/**
 * Tamagui's own shadow names read the theme's shadow role.
 *
 * A fixed colour here would sit outside theme-tokens and suit only one kind of theme: a light
 * theme's shadow on a dark theme is a quarter as strong as it should be. Any component using
 * Tamagui's `shadowColor` resolves through these names.
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
