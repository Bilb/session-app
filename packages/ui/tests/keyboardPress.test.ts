import { describe, expect, it, vi } from 'vitest'

import {
  focusRing,
  heldButton,
  keyboardPress,
  pressOnKey,
  type PressKeyEvent,
} from '#src/keyboardPress'
import { pressHint } from '#src/pressHint'
import { buildThemes } from '#src/themes'

const element = {}

function key(name: string, overrides: Partial<PressKeyEvent> = {}): PressKeyEvent {
  return {
    key: name,
    repeat: false,
    target: element,
    currentTarget: element,
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('a key on a focused pressable stack', () => {
  it('presses on Enter and on Space, as a button does', () => {
    const onPress = vi.fn()
    const handle = pressOnKey(onPress)
    handle(key('Enter'))
    handle(key(' '))
    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('keeps Space from scrolling what the control sits in', () => {
    const space = key(' ')
    pressOnKey(vi.fn())(space)
    expect(space.preventDefault).toHaveBeenCalled()
  })

  it('ignores every other key, and leaves it to the page', () => {
    const onPress = vi.fn()
    for (const name of ['a', 'Tab', 'Escape', 'ArrowDown', 'Spacebar']) {
      const event = key(name)
      pressOnKey(onPress)(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not press a stack for a key meant for a control nested in it', () => {
    // The key bubbles to the outer handler with the control as its target.
    const onPress = vi.fn()
    pressOnKey(onPress)(key('Enter', { target: {} }))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('presses once for a held key, not once per repeat', () => {
    const onPress = vi.fn()
    pressOnKey(onPress)(key('Enter', { repeat: true }))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('what a stack spreads to take the keyboard', () => {
  const ring = focusRing({ onAccent: false, offset: 0, radius: '$sm' })

  it('is nothing where the stack takes no press, so it is no tab stop', () => {
    expect(keyboardPress(undefined, ring)).toEqual({})
  })

  it('is a tab stop with a key handler and a ring shown only to the keyboard', () => {
    const props = keyboardPress(vi.fn(), ring)
    expect(props).toMatchObject({ tabIndex: 0, focusVisibleStyle: ring })
    expect(props).toHaveProperty('onKeyDown')
  })
})

describe('a button held while a transfer runs', () => {
  const ring = focusRing({ onAccent: false, offset: 0, radius: '$sm' })

  it('stays a named tab stop, so focus on it is not dropped to the page', () => {
    expect(heldButton('Downloading', ring)).toMatchObject({
      role: 'button',
      'aria-label': 'Downloading',
      tabIndex: 0,
      focusVisibleStyle: ring,
    })
  })

  it('leaves the disabled state to its caller, who must clear it as well as set it', () => {
    // Android keeps a disabled state whose prop is dropped rather than set to false.
    expect(heldButton('Downloading', ring)).not.toHaveProperty('aria-disabled')
  })

  it('takes no key, since it presses nothing', () => {
    expect(heldButton(undefined, ring)).not.toHaveProperty('onKeyDown')
    expect(heldButton(undefined, ring)).not.toHaveProperty('aria-label')
  })
})

describe('the focus ring', () => {
  it.each(Object.entries(buildThemes()))('is the colour %s gives focus', (_, theme) => {
    expect(theme['outlineColor']).toBe(theme['primaryColor'])
  })

  it('is the theme’s focus colour on the page', () => {
    expect(focusRing({ onAccent: false, offset: 2, radius: '$sm' })).toMatchObject({
      outlineColor: '$primaryColor',
      outlineOffset: 2,
      outlineWidth: 2,
      outlineStyle: 'solid',
    })
  })

  it('is the on-accent colour on an accent fill, where the accent would be the fill itself', () => {
    expect(focusRing({ onAccent: true, offset: 0, radius: '$full' }).outlineColor).toBe('$onAccent')
  })
})

describe('a press hint', () => {
  it('is ARIA’s description on the web and is absent with nothing to say', () => {
    expect(pressHint('Open')).toEqual({ 'aria-description': 'Open' })
    expect(pressHint(undefined)).toEqual({})
  })
})
