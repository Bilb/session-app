import { describe, expect, it } from 'vitest'

import { SPACE_SCALE } from '#src/scales'
import { tooltipPosition } from '#src/tooltipPosition'

const GAP = SPACE_SCALE.xs

describe("a tooltip's position", () => {
  it('opens past the end edge by the gap, centred down the control, mirroring with the page', () => {
    expect(tooltipPosition('end', GAP)).toEqual({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      insetInlineStart: '100%',
      marginInlineStart: GAP,
    })
  })

  it('opens past the start edge the same way', () => {
    expect(tooltipPosition('start', GAP)).toMatchObject({
      insetInlineEnd: '100%',
      marginInlineEnd: GAP,
      transform: 'translateY(-50%)',
    })
  })

  it('opens above or below, centred across the control', () => {
    expect(tooltipPosition('top', GAP)).toMatchObject({
      bottom: '100%',
      marginBottom: GAP,
      transform: 'translateX(-50%)',
    })
    expect(tooltipPosition('bottom', GAP)).toMatchObject({
      top: '100%',
      marginTop: GAP,
      transform: 'translateX(-50%)',
    })
  })

  it('never uses a physical side for a side that follows the reading direction', () => {
    for (const placement of ['start', 'end'] as const) {
      const style = tooltipPosition(placement, GAP)
      expect(style).not.toHaveProperty('left')
      expect(style).not.toHaveProperty('right')
    }
  })
})
