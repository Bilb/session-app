import { describe, expect, it } from 'vitest'

import { leadingInset, placeMenu, placeSubmenu, type MenuGeometry } from '#src/contextMenuPlacement'

/** The menu's own margin, which the expected positions below are worked out from. */
const MARGIN = 8
const LTR: MenuGeometry = { bounds: { width: 1000, height: 800 }, margin: MARGIN, rtl: false }
const RTL: MenuGeometry = { ...LTR, rtl: true }
const PANEL = { width: 200, height: 300 }

describe('a context menu opened at a point', () => {
  it('grows toward the trailing edge and down from the pointer', () => {
    expect(placeMenu({ kind: 'point', x: 100, y: 100 }, PANEL, LTR, 4)).toMatchObject({
      x: 100,
      y: 100,
    })
  })

  it('grows back from the pointer on whichever axis runs out', () => {
    expect(placeMenu({ kind: 'point', x: 900, y: 700 }, PANEL, LTR, 4)).toMatchObject({
      x: 700,
      y: 400,
    })
  })

  it('mirrors right to left', () => {
    expect(placeMenu({ kind: 'point', x: 500, y: 100 }, PANEL, RTL, 4)).toMatchObject({ x: 300 })
    expect(placeMenu({ kind: 'point', x: 100, y: 100 }, PANEL, RTL, 4)).toMatchObject({ x: 100 })
  })

  it('stays whole when neither way fits, and scrolls when taller than the window', () => {
    const narrow: MenuGeometry = { ...LTR, bounds: { width: 300, height: 200 } }
    expect(placeMenu({ kind: 'point', x: 150, y: 100 }, PANEL, narrow, 4)).toEqual({
      x: 92,
      y: 8,
      maxHeight: 184,
    })
  })
})

describe('a context menu opened against an element', () => {
  const rect = { x: 300, y: 100, width: 400, height: 80 }

  it('hangs below it from its leading edge', () => {
    expect(placeMenu({ kind: 'element', rect }, PANEL, LTR, 4)).toMatchObject({ x: 300, y: 184 })
    expect(placeMenu({ kind: 'element', rect }, PANEL, RTL, 4)).toMatchObject({ x: 500, y: 184 })
  })

  it('goes above when below has no room, and over it when neither has', () => {
    const low = { ...rect, y: 600 }
    expect(placeMenu({ kind: 'element', rect: low }, PANEL, LTR, 4)).toMatchObject({ y: 296 })
    const tall = { ...rect, y: 200, height: 500 }
    expect(placeMenu({ kind: 'element', rect: tall }, PANEL, LTR, 4)).toMatchObject({ y: 200 })
  })
})

describe('a submenu', () => {
  const parent = { x: 100, y: 100, width: 200, height: 300 }
  const row = { x: 100, y: 200, width: 200, height: 40 }

  it('opens beside its parent on the trailing side, its first row level with the opener', () => {
    expect(placeSubmenu(row, parent, PANEL, LTR, 4, 4)).toMatchObject({ x: 296, y: 196 })
  })

  it('opens on the leading side when the trailing one has no room', () => {
    const atEnd = { ...parent, x: 700 }
    expect(placeSubmenu(row, atEnd, PANEL, LTR, 4, 4)).toMatchObject({ x: 504 })
  })

  it('mirrors right to left', () => {
    const atEnd = { ...parent, x: 700 }
    expect(placeSubmenu(row, atEnd, PANEL, RTL, 4, 4)).toMatchObject({ x: 504 })
    expect(placeSubmenu(row, parent, PANEL, RTL, 4, 4)).toMatchObject({ x: 296 })
  })
})

describe('a leading inset', () => {
  it('is the physical x left to right, and measured from the right right to left', () => {
    expect(leadingInset(100, 200, LTR)).toBe(100)
    expect(leadingInset(100, 200, RTL)).toBe(700)
  })
})
