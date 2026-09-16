import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The two halves of `PressArea` must stack their child the same way.
 *
 * The split exists for the press gesture and for nothing else -- the native half hands the
 * touch to react-native's `Pressable` so a finger sliding off a control behaves the way the
 * platform does. Layout is not part of the difference, and when it became part of it the
 * damage was invisible on the platform the split was written for.
 *
 * `Pressable` is a view: it stacks down the page and stretches its children across. The web
 * half used a row, which stretches the other axis and leaves the child sized to its own
 * content -- so on desktop every button drew to the width of its label rather than the width
 * it was given, and a label too long for that width overflowed rather than wrapping. On the
 * landing screen that was two buttons at 137 and 152 in a 348 column, and a terms sentence
 * 429 wide in the same 348.
 *
 * A grep rather than a render test because the mistake is not a wrong value: jsdom computes
 * no layout, so the only thing a render test could assert here is the very element name this
 * reads. The measurement that catches it for real is the e2e pass over a running app.
 */
describe('the web PressArea', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/PressArea.tsx'), 'utf8')

  it('stacks in a column, as the native half does', () => {
    expect(source).toMatch(/<YStack\b/)
  })

  it('is not a row', () => {
    expect(source).not.toMatch(/<XStack\b|flexDirection=["{]?["']?row/)
  })
})
