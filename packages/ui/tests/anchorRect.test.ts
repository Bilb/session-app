import { describe, expect, it } from 'vitest'

import { measureAnchor, panelLeft, panelPlacement } from '#src/anchorRect'

/**
 * The placement arithmetic, which is the part of a dropdown that is wrong in ways nobody notices
 * until a particular window size: a panel half off the screen, or one opening downwards into a
 * strip too short to hold it.
 */
const GAP = 6
const MARGIN = 12
const MIN = 260

const trigger = (x: number, y: number) => ({ x, y, width: 60, height: 32 })

describe('placing the panel horizontally', () => {
  it('aligns the panel’s right edge with the trigger’s', () => {
    // 600 + 60 - 320. The trigger is narrower than the panel, so the panel hangs to its left.
    expect(panelLeft(trigger(600, 100), 320, 1000, MARGIN)).toBe(340)
  })

  it('never runs off the right edge', () => {
    // A trigger in the top-right corner is the common case on a phone.
    expect(panelLeft(trigger(320, 20), 320, 390, MARGIN)).toBe(390 - 320 - MARGIN)
  })

  it('never runs off the left edge', () => {
    // A panel wider than the window: the margin wins, and it is clipped rather than shifted out.
    expect(panelLeft(trigger(0, 20), 320, 300, MARGIN)).toBe(MARGIN)
  })
})

describe('choosing a side to open on', () => {
  it('opens below when there is room, because the chevron points down', () => {
    const placed = panelPlacement(trigger(600, 80), 900, GAP, MARGIN, MIN)
    expect(placed.side).toBe('below')
    expect(placed.offset).toBe(80 + 32 + GAP)
    expect(placed.available).toBe(900 - 80 - 32 - GAP - MARGIN)
  })

  it('flips above when below cannot hold the panel and above can hold more', () => {
    // A trigger low in a short window: below has 62px, above has 682.
    const placed = panelPlacement(trigger(600, 700), 800, GAP, MARGIN, MIN)
    expect(placed.side).toBe('above')
    // Measured from the bottom of the window, which is what `bottom` takes.
    expect(placed.offset).toBe(800 - 700 + GAP)
    expect(placed.available).toBe(700 - GAP - MARGIN)
  })

  it('stays below when flipping would buy nothing', () => {
    // Both sides are too short. Moving the control for no gain is worse than a short panel.
    const placed = panelPlacement(trigger(600, 100), 260, GAP, MARGIN, MIN)
    expect(placed.side).toBe('below')
  })
})

describe('measuring the trigger', () => {
  it('reads a DOM node through getBoundingClientRect', () => {
    let measured: unknown = 'unset'
    measureAnchor(
      { getBoundingClientRect: () => ({ left: 4, top: 8, width: 60, height: 32 }) },
      (r) => {
        measured = r
      },
    )
    expect(measured).toEqual({ x: 4, y: 8, width: 60, height: 32 })
  })

  it('prefers measureInWindow, which is the one a device has', () => {
    let measured: unknown = 'unset'
    measureAnchor(
      {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
          cb(4, 8, 60, 32)
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
      },
      (r) => {
        measured = r
      },
    )
    expect(measured).toEqual({ x: 4, y: 8, width: 60, height: 32 })
  })

  it('answers null rather than a guess when there is nothing to measure', () => {
    // The picker uses the rectangle as its open flag, so null here keeps the panel shut rather
    // than drawing it against made-up coordinates.
    let measured: unknown = 'unset'
    measureAnchor(null, (r) => {
      measured = r
    })
    expect(measured).toBeNull()
  })
})
