import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The two halves of `PressArea` must stack their child the same way.
 *
 * The split exists for the press gesture and nothing else: the native half hands the touch to
 * react-native's `Pressable` so a finger sliding off a control behaves the way the platform does.
 * Layout is not part of the difference, and a divergence there is invisible on the platform the
 * split was written for.
 *
 * `Pressable` is a view -- it stacks down the page and stretches its children across. A row does
 * the opposite, leaving the child sized to its own content, which draws every button to the width
 * of its label and overflows a label too long for it.
 *
 * A grep rather than a render test because jsdom computes no layout, so the only thing a render
 * test could assert is the element name this already reads. The e2e pass over a running app is
 * what catches it for real.
 */
describe('the web PressArea', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/PressArea.tsx'), 'utf8')

  it('stacks in a column, as the native half does', () => {
    expect(source).toMatch(/<YStack\b/)
  })

  it('is not a row', () => {
    expect(source).not.toMatch(/<XStack\b|flexDirection=["{]?["']?row/)
  })

  it('is a tab stop that Enter and Space press, wherever a pointer could press it', () => {
    // tamagui hands `onPress` a click and nothing else, so every Button in the app needs this.
    expect(source).toContain('const press = disabled ? undefined : onPress')
    expect(source).toContain('onPress={press}')
    expect(source).toContain('{...keyboardPress(press, focusRing(ring))}')
  })
})

describe('the native PressArea', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/PressArea.native.tsx'), 'utf8')

  it('takes no tab index, which on iOS would hide what it holds from VoiceOver', () => {
    expect(source).not.toMatch(/keyboardPress|tabIndex/)
  })
})

describe('a Button', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/Button.tsx'), 'utf8')
  const frame = source.slice(source.indexOf('const Frame = styled('), source.indexOf('variants:'))

  it('leaves the role to its PressArea on the web, so one control is one button', () => {
    expect(frame).not.toContain('role')
    expect(source).toContain("const FRAME_ROLE = isWeb ? {} : ({ role: 'button' } as const)")
    expect(source).toContain('{...FRAME_ROLE}')
  })

  it('hands its PressArea a ring in the shape and fill it is drawn on', () => {
    expect(source).toContain('ring={ring}')
    expect(source).toMatch(/radius: variant === 'tonal' \? '\$sm' : '\$full'/)
  })

  it('reads onAccent for its ring alone, keeping its own fill on a bubble you sent', () => {
    expect(source).not.toMatch(/onAccent \?/)
    expect(source.match(/\{ onAccent, offset:/g)).toHaveLength(2)
  })
})
