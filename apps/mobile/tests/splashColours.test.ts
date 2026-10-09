/// <reference types="node" />
import { readFileSync } from 'node:fs'

import { DEFAULT_ACCENT, DEFAULT_THEME, getThemeTokens } from '@session/theme-tokens'
import { describe, expect, it } from 'vitest'

/**
 * The native launch screen's background, which app.config.ts has to write as a literal: Expo
 * loads that file with Node, which cannot load the theme package's TypeScript. This is what keeps
 * the literal honest - if the default theme's background moves, the splash would crossfade from
 * one black into another, and the app-switcher cover with it, with nothing else saying so.
 */
describe('the native launch screen', () => {
  it("is the default theme's background", () => {
    const config = readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8')
    const splash = /'expo-splash-screen',\s*\{[^}]*?backgroundColor: '(#[0-9A-Fa-f]{6})'/s.exec(
      config,
    )
    expect(splash?.[1]?.toUpperCase()).toBe(
      getThemeTokens(DEFAULT_THEME, DEFAULT_ACCENT).backgroundPrimary.toUpperCase(),
    )
  })
})
