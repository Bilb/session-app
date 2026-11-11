import { describe, expect, it } from 'vitest'

import type { ContextMenuEntry } from '#src/contextMenuEntries'
import { menuKeyAction, type MenuKeyContext } from '#src/contextMenuKeys'

const row = (id: string, extra: Partial<ContextMenuEntry> = {}): ContextMenuEntry =>
  ({ id, kind: 'action', label: id, testID: id, onSelect: () => {}, ...extra }) as ContextMenuEntry

const ENTRIES: readonly ContextMenuEntry[] = [
  row('reply'),
  { id: 'line', kind: 'separator' },
  row('copy', { disabled: true }),
  { id: 'more', kind: 'submenu', label: 'More', testID: 'more', entries: [row('inner')] },
  row('delete'),
]

const at = (active: number, extra: Partial<MenuKeyContext> = {}): MenuKeyContext => ({
  entries: ENTRIES,
  active,
  nested: false,
  rtl: false,
  ...extra,
})

describe('a key in a context menu', () => {
  it('moves down past a separator onto a disabled row, which is still a stop', () => {
    expect(menuKeyAction('ArrowDown', at(0))).toEqual({ kind: 'move', index: 2 })
  })

  it('wraps at both ends', () => {
    expect(menuKeyAction('ArrowDown', at(4))).toEqual({ kind: 'move', index: 0 })
    expect(menuKeyAction('ArrowUp', at(0))).toEqual({ kind: 'move', index: 4 })
  })

  it('starts from the first or last row when none is active, as after a right-click', () => {
    expect(menuKeyAction('ArrowDown', at(-1))).toEqual({ kind: 'move', index: 0 })
    expect(menuKeyAction('ArrowUp', at(-1))).toEqual({ kind: 'move', index: 4 })
  })

  it('jumps with Home and End', () => {
    expect(menuKeyAction('Home', at(3))).toEqual({ kind: 'move', index: 0 })
    expect(menuKeyAction('End', at(0))).toEqual({ kind: 'move', index: 4 })
  })

  it('chooses with Enter and Space, but not a disabled row', () => {
    expect(menuKeyAction('Enter', at(0))).toEqual({ kind: 'activate', index: 0 })
    expect(menuKeyAction(' ', at(4))).toEqual({ kind: 'activate', index: 4 })
    expect(menuKeyAction('Enter', at(2))).toBeNull()
    expect(menuKeyAction('Enter', at(-1))).toBeNull()
  })

  it('opens a submenu with Enter or the key toward the trailing edge', () => {
    expect(menuKeyAction('Enter', at(3))).toEqual({ kind: 'openSubmenu', index: 3 })
    expect(menuKeyAction('ArrowRight', at(3))).toEqual({ kind: 'openSubmenu', index: 3 })
    expect(menuKeyAction('ArrowRight', at(0))).toBeNull()
  })

  it('mirrors the submenu keys right to left', () => {
    expect(menuKeyAction('ArrowLeft', at(3, { rtl: true }))).toEqual({
      kind: 'openSubmenu',
      index: 3,
    })
    expect(menuKeyAction('ArrowRight', at(3, { rtl: true }))).toBeNull()
    expect(menuKeyAction('ArrowRight', at(0, { rtl: true, nested: true }))).toEqual({
      kind: 'closeLevel',
    })
  })

  it('closes one level with Escape or the key back, and the whole menu from the first', () => {
    expect(menuKeyAction('Escape', at(0, { nested: true }))).toEqual({ kind: 'closeLevel' })
    expect(menuKeyAction('ArrowLeft', at(0, { nested: true }))).toEqual({ kind: 'closeLevel' })
    expect(menuKeyAction('Escape', at(0))).toEqual({ kind: 'dismiss' })
    expect(menuKeyAction('ArrowLeft', at(0))).toBeNull()
  })

  it('leaves the whole menu with Tab', () => {
    expect(menuKeyAction('Tab', at(0, { nested: true }))).toEqual({ kind: 'dismiss' })
  })

  it('moves to the next row starting with a typed letter, wrapping', () => {
    expect(menuKeyAction('d', at(0))).toEqual({ kind: 'move', index: 4 })
    expect(menuKeyAction('R', at(4))).toEqual({ kind: 'move', index: 0 })
    expect(menuKeyAction('z', at(0))).toBeNull()
    expect(menuKeyAction('Shift', at(0))).toBeNull()
  })
})
