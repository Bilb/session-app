import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../src')

/** Every shared component that wraps its frame in a `PressArea`. */
const wrappers = readdirSync(SRC)
  .filter((file) => file.endsWith('.tsx') && !file.startsWith('PressArea'))
  .map((file) => ({ file, source: readFileSync(join(SRC, file), 'utf8') }))
  .filter(({ source }) => source.includes('<PressArea'))

/**
 * A frame inside a `PressArea` that declares a `pressStyle` must let the touch through.
 *
 * tamagui attaches its own press handling on native to any view that declares one, so the frame
 * claims the touch and the `Pressable` around it never fires: the control draws and cannot be
 * pressed on a phone, while on the web -- where the passthrough is empty -- it works.
 *
 * A grep, as `Button.contract.test.ts` is: this package has no native renderer to press with.
 */
describe('a PressArea frame with a press style', () => {
  it('is found by this test at all, so a move cannot make it vacuous', () => {
    expect(wrappers.map(({ file }) => file)).toEqual(
      expect.arrayContaining(['Button.tsx', 'SettingsRow.tsx']),
    )
  })

  it('spreads PRESS_PASSTHROUGH', () => {
    const missing = wrappers
      .filter(({ source }) => /pressStyle/.test(source) && !/\.\.\.PRESS_PASSTHROUGH/.test(source))
      .map(({ file }) => file)
    expect(missing).toEqual([])
  })
})
