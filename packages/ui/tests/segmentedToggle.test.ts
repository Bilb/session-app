import { describe, expect, it } from 'vitest'

import { MIN_HIT_TARGET } from '#src/buttonHitTarget'
import { selectedSegment } from '#src/segmentedToggle'
import * as web from '#src/segmentedToggleMetrics'
import * as native from '#src/segmentedToggleMetrics.native'

describe('a segmented toggle’s segments', () => {
  it('are their own touch target on native, so no slop overlaps the neighbour', () => {
    expect(native.SEGMENT_HEIGHT).toBeGreaterThanOrEqual(MIN_HIT_TARGET)
    expect(native.SEGMENT_WIDTH).toBeGreaterThanOrEqual(MIN_HIT_TARGET)
  })

  it('are drawn small on the web, where a pointer needs no more than what is drawn', () => {
    expect(web.SEGMENT_HEIGHT).toBeLessThan(MIN_HIT_TARGET)
  })
})

describe('which segment is selected', () => {
  const segments = [{ value: 'gallery' }, { value: 'list' }] as const

  it('is the one whose value is current', () => {
    expect(selectedSegment(segments, 'gallery')).toBe(0)
    expect(selectedSegment(segments, 'list')).toBe(1)
  })

  it('is neither when the value matches no segment', () => {
    expect(selectedSegment<string>(segments, 'grid')).toBe(-1)
  })
})
