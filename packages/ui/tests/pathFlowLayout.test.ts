import { describe, expect, it } from 'vitest'

import { layoutPathFlow, placeInLayout } from '#src/pathFlowLayout'

const laidOut = layoutPathFlow(
  [
    { key: 'a', countries: ['DE', 'US', 'FI', 'DE'] },
    { key: 'b', countries: ['US', 'DE', 'FI', 'FS'] },
    { key: 'c', countries: ['DE', 'DE', 'US', 'DE'] },
  ],
  380,
  300,
)

describe('placeInLayout', () => {
  it('puts a new path inside the bars it crosses, leaving every bar where it was', () => {
    const before = JSON.stringify(laidOut.bars)
    const pts = placeInLayout(laidOut, { key: 'd', countries: ['US', 'DE', 'FI', 'DE'] })
    expect(pts).not.toBeNull()
    const countries = ['you', 'US', 'DE', 'FI', 'DE']
    pts?.forEach(([x, y], column) => {
      const bar = laidOut.bars.find((b) => b.column === column && b.country === countries[column])
      expect(bar).toBeDefined()
      if (!bar) return
      expect(x).toBe(laidOut.columnX[column])
      expect(y).toBeGreaterThanOrEqual(bar.y)
      expect(y).toBeLessThanOrEqual(bar.y + bar.height)
    })
    expect(JSON.stringify(laidOut.bars)).toBe(before)
  })

  it('places a path the same way every time, so its line is not drawn again', () => {
    const path = { key: 'e', countries: ['DE', 'FI', 'FI', 'DE'] }
    expect(placeInLayout(laidOut, path)).toEqual(placeInLayout(laidOut, path))
  })

  it('leaves a path for the next layout when a column has no bar for its country', () => {
    expect(placeInLayout(laidOut, { key: 'f', countries: ['SG', 'US', 'FI', 'DE'] })).toBeNull()
  })
})
