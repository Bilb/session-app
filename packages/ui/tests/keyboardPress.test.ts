import { describe, expect, it, vi } from 'vitest'

import { focusRing, heldButton, keyboardPress, type PressKeyEvent } from '#src/keyboardPress'
import { pressHint } from '#src/pressHint'

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

const ring = focusRing({ onAccent: false, offset: 0, radius: '$sm' })

function keyHandler(onPress: () => void): (event: PressKeyEvent) => void {
  const props = keyboardPress(onPress, ring)
  if (!('onKeyDown' in props)) throw new Error('a pressable stack took no keys')
  const { onKeyDown } = props
  // The handler is typed for react-native's key event; on the web it receives the DOM's.
  return (event) => {
    onKeyDown(event as unknown as Parameters<typeof onKeyDown>[0])
  }
}

describe('a key on a focused pressable stack', () => {
  it('presses on Enter and on Space, as a button does', () => {
    const onPress = vi.fn()
    const handle = keyHandler(onPress)
    handle(key('Enter'))
    handle(key(' '))
    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('keeps Space from scrolling what the control sits in', () => {
    const space = key(' ')
    keyHandler(vi.fn())(space)
    expect(space.preventDefault).toHaveBeenCalled()
  })

  it('ignores every other key, and leaves it to the page', () => {
    const onPress = vi.fn()
    for (const name of ['a', 'Tab', 'Escape', 'ArrowDown', 'Spacebar']) {
      const event = key(name)
      keyHandler(onPress)(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not press a stack for a key meant for a control nested in it', () => {
    // The key bubbles to the outer handler with the control as its target.
    const onPress = vi.fn()
    keyHandler(onPress)(key('Enter', { target: {} }))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('presses once for a held key, not once per repeat', () => {
    const onPress = vi.fn()
    keyHandler(onPress)(key('Enter', { repeat: true }))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('what a stack spreads to take the keyboard', () => {
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

describe('a press hint', () => {
  it('is ARIA’s description on the web and is absent with nothing to say', () => {
    expect(pressHint('Open')).toEqual({ 'aria-description': 'Open' })
    expect(pressHint(undefined)).toEqual({})
  })
})
