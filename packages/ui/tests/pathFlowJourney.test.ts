import { describe, expect, it } from 'vitest'

import { journeyAt, journeyOf, NODE_HOLD_MS, ringsAt } from '#src/pathFlowJourney'
import { FLOW_SIDE, layoutPathFlow, pointAlong } from '#src/pathFlowLayout'

const HOP = 300

describe('journeyOf', () => {
  it('stops at every node, takes a layer off on the way out and puts one on on the way back', () => {
    const j = journeyOf(HOP, 4, true)
    // Out to the entry node, then held there with one layer gone.
    expect(journeyAt(j, HOP / 2)).toEqual({ h: 0.5, back: false, layers: 4 })
    expect(journeyAt(j, HOP + NODE_HOLD_MS / 2)).toEqual({ h: 1, back: false, layers: 3 })
    expect(ringsAt(j, HOP + 10).map((r) => [r.ring.kind, r.ring.hop])).toEqual([['peel', 1]])

    const homeward = j.legs.find((leg) => leg.toHop < leg.fromHop)
    expect(homeward).toBeDefined()
    if (!homeward) return
    // The destination read it bare and sent the answer back wrapped once.
    expect(journeyAt(j, homeward.startMs + 1)).toMatchObject({ back: true, layers: 1 })
    // Home with every layer the nodes put on, taken off at once.
    expect(journeyAt(j, j.totalMs - 1)?.layers).toBe(4)
    expect(j.rings.at(-1)).toMatchObject({ hop: 0, kind: 'open' })
    expect(journeyAt(j, j.totalMs)).toBeNull()
  })

  it('reaches the file server bare: its last column lies past the relay that unwraps it', () => {
    const j = journeyOf(HOP, 3, true)
    const atServer = j.legs.find((leg) => leg.fromHop === 4 && leg.toHop === 4)
    expect(atServer?.layers).toBe(0)
    expect(j.rings.filter((r) => r.hop === 4)).toEqual([])
  })

  it('goes out and back without stopping when drawn without layers, as a ping is', () => {
    const j = journeyOf(HOP, 4, false)
    expect(j.totalMs).toBe(8 * HOP)
    expect(j.rings).toEqual([])
  })
})

describe('pointAlong', () => {
  it('stops a request in the middle of each bar, and runs the line between their edges', () => {
    const layout = layoutPathFlow([{ key: 'p', countries: ['DE', 'US', 'FI', 'DE'] }], 380, 190, 72)
    const pts = layout.points.get('p') ?? []
    for (let h = 0; h <= 4; h += 1) {
      const [x] = pointAlong(pts, h, layout.barWidth)
      expect(x).toBeCloseTo((layout.columnX[h] ?? 0) + layout.barWidth / 2)
    }
    // The destination's title ends at the right margin, and its bar sits under the title's start.
    expect(layout.columnX[4]).toBe(380 - FLOW_SIDE - 72)
  })
})
