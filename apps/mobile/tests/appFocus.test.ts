/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Held by reading the source: the port is wired to React Native's AppState, which this tier has no
 * runtime for.
 */
const platform = readFileSync(join(import.meta.dirname, '../src/platform.ts'), 'utf8')

describe("the phone's window port", () => {
  it('says whether the app is in front from AppState, not the memory port that never changes', () => {
    expect(platform).toContain('isFocused: () => isActive(AppState.currentState)')
    expect(platform).toMatch(/AppState\.addEventListener\('change'/)
    expect(platform).toMatch(/window: \{\s*\.\.\.ports\.window,\s*\.\.\.appFocus,/)
  })

  it('counts only `active` as in front', () => {
    expect(platform).toContain(
      "const isActive = (state: string | null | undefined): boolean => state === 'active'",
    )
  })
})
