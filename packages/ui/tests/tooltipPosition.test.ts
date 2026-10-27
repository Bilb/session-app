import { describe, expect, it } from 'vitest'

import { SPACE_SCALE } from '#src/scales'
import { tooltipPosition } from '#src/tooltipPosition'

const GAP = SPACE_SCALE.xs

describe("a tooltip's position", () => {
  it('opens past the end edge by the gap, held as padding so crossing it is not leaving, centred down the control, mirroring with the page', () => {
    expect(tooltipPosition('end', GAP)).toEqual({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      minHeight: '100%',
      insetInlineStart: '100%',
      paddingInlineStart: GAP,
    })
  })

  it('opens past the start edge the same way', () => {
    expect(tooltipPosition('start', GAP)).toMatchObject({
      insetInlineEnd: '100%',
      paddingInlineEnd: GAP,
      transform: 'translateY(-50%)',
    })
  })

  it('spans the whole edge it opens from, so leaving anywhere along it is not leaving', () => {
    expect(tooltipPosition('end', GAP)).toMatchObject({ minHeight: '100%' })
    expect(tooltipPosition('start', GAP)).toMatchObject({ minHeight: '100%' })
    expect(tooltipPosition('top', GAP)).toMatchObject({ minWidth: '100%' })
    expect(tooltipPosition('bottom', GAP)).toMatchObject({ minWidth: '100%' })
  })

  it('opens above or below, centred across the control', () => {
    expect(tooltipPosition('top', GAP)).toMatchObject({
      bottom: '100%',
      paddingBottom: GAP,
      transform: 'translateX(-50%)',
    })
    expect(tooltipPosition('bottom', GAP)).toMatchObject({
      top: '100%',
      paddingTop: GAP,
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
