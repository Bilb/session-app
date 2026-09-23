import { describe, expect, it } from 'vitest'

import { advance, windowSizeChanged, type Replacement } from '#src/keyboardHold'

describe('arming a keyboard hold', () => {
  it('ignores a first measurement, which would hold on every mount', () => {
    expect(windowSizeChanged(null, '834x1210')).toBe(false)
  })

  it('ignores a re-measurement of the same size', () => {
    expect(windowSizeChanged('834x1210', '834x1210')).toBe(false)
  })

  it('arms on a rotation', () => {
    expect(windowSizeChanged('834x1210', '1210x834')).toBe(true)
  })

  /** A split view replaces the keyboard without the device turning. */
  it('arms on a resize that is not a rotation', () => {
    expect(windowSizeChanged('1210x834', '700x834')).toBe(true)
  })
})

/** Replays the heights a real rotation reported, in order, against the height being held. */
function through(heights: number[]): Replacement {
  const held = heights[0] ?? 0
  return heights.reduce<Replacement>((stage, height) => advance(stage, height, held), 'before')
}

describe('a keyboard being replaced', () => {
  /**
   * The sequence measured on an iPad: the old height is still being reported when the hold is
   * armed, then zero, then the new keyboard.
   */
  it('is done once a height arrives after the gap', () => {
    expect(through([428, 0, 340])).toBe('done')
  })

  it('is still waiting inside the gap, which is what the hold covers', () => {
    expect(through([428, 0])).toBe('waiting')
  })

  /**
   * The mistake this replaces: at arming the height is the old keyboard's, so releasing on any
   * height above zero releases at once and holds nothing.
   */
  it('has not started while only the old height has been seen', () => {
    expect(through([428])).toBe('before')
    expect(through([428, 428])).toBe('before')
  })

  /** Two orientations can give the same keyboard height; the gap is what counts, not the value. */
  it('is done even where the replacement is the same height as the old one', () => {
    expect(through([428, 0, 428])).toBe('done')
  })

  it('stays done rather than re-arming on later keyboard movement', () => {
    expect(through([428, 0, 340, 0, 340])).toBe('done')
  })

  /**
   * The other route, measured on the same device: no zero between the two keyboards. Waiting for
   * one leaves this held until the ceiling expires.
   */
  it('is done where the height changes with no gap reported at all', () => {
    expect(through([428, 340])).toBe('done')
  })
})
