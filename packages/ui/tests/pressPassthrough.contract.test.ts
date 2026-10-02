import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A frame inside a `PressArea` that declares a `pressStyle` must pass the touch through.
 *
 * tamagui attaches its own press handling to any view that declares one, so on native the frame
 * claims the touch and the `Pressable` around it never fires: the control draws and does nothing.
 * Invisible on the web, where the split does not apply. A grep rather than a render test, for the
 * reason `pressArea.contract.test.ts` gives: nothing short of a device shows the failure.
 */
describe('a PressArea whose child styles its own press', () => {
  const dir = join(import.meta.dirname, '../src')
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.startsWith('PressArea'))
  const found: string[] = []

  for (const file of files) {
    const source = readFileSync(join(dir, file), 'utf8')
    if (!source.includes('<PressArea') || !/\bpressStyle[=:]/.test(source)) continue
    found.push(file)
    it(`${file} spreads PRESS_PASSTHROUGH into it`, () => {
      expect(source).toMatch(/\{\.\.\.PRESS_PASSTHROUGH\}/)
    })
  }

  it('is found at all, so a rename cannot leave the cases above ungenerated', () => {
    expect(found).toContain('Button.tsx')
  })
})
