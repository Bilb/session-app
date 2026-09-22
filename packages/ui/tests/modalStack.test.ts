import { describe, expect, it } from 'vitest'

import { backAction, dismissFrom, type StackedModal } from '../src/modalStack'

function modal(id: string, screens = 1, dismissible = true): StackedModal {
  return { id, screens, dismissible }
}

describe('backAction', () => {
  it('does nothing when nothing is open', () => {
    expect(backAction([])).toEqual({ kind: 'none' })
  })

  it('closes a modal sitting on its own first screen', () => {
    expect(backAction([modal('settings')])).toEqual({ kind: 'modal' })
  })

  it('walks back a screen before closing the modal it is in', () => {
    expect(backAction([modal('settings', 3)])).toEqual({ kind: 'screen' })
  })

  it('closes the modal once its screens are back to the first', () => {
    expect(backAction([modal('settings', 1)])).toEqual({ kind: 'modal' })
  })

  it('answers for the topmost modal, not the one underneath', () => {
    // Deep in settings, with a confirmation over the top. Back belongs to the confirmation.
    expect(backAction([modal('settings', 4), modal('confirm')])).toEqual({ kind: 'modal' })
  })

  it('walks the topmost modal own screens even when a deeper one is underneath', () => {
    expect(backAction([modal('settings', 4), modal('picker', 2)])).toEqual({ kind: 'screen' })
  })

  it('stops at a modal that refuses dismissal rather than closing its parent', () => {
    expect(backAction([modal('settings', 3), modal('confirm', 1, false)])).toEqual({ kind: 'none' })
  })

  it('still walks the screens of a modal that refuses dismissal', () => {
    // Refusing to be closed is not refusing to be navigated: a wizard that must be finished can
    // still have its own back.
    expect(backAction([modal('wizard', 2, false)])).toEqual({ kind: 'screen' })
  })
})

describe('dismissFrom', () => {
  it('removes the named modal', () => {
    expect(dismissFrom([modal('a'), modal('b')], 'b').map((m) => m.id)).toEqual(['a'])
  })

  it('removes everything opened from it', () => {
    const stack = [modal('a'), modal('b'), modal('c')]
    expect(dismissFrom(stack, 'b').map((m) => m.id)).toEqual(['a'])
  })

  it('empties the stack when the bottom one goes', () => {
    expect(dismissFrom([modal('a'), modal('b')], 'a')).toEqual([])
  })

  it('leaves the stack alone for an id that is not there', () => {
    const stack = [modal('a'), modal('b')]
    expect(dismissFrom(stack, 'gone').map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('leaves an empty stack empty', () => {
    expect(dismissFrom([], 'a')).toEqual([])
  })

  it('does not hand back the array it was given', () => {
    // The stack goes into react state, where mutating the previous value is invisible until it is
    // not. Every path returns a new array, including the ones that change nothing.
    const stack = [modal('a')]
    expect(dismissFrom(stack, 'gone')).not.toBe(stack)
  })
})
