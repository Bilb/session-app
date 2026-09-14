import { describe, expect, it } from 'vitest'

import { COLUMN_WIDTH, heroWidth } from '#src/onboarding/heroPanel'

/** The artwork is this much wider than it is tall, so a panel's width says how much of it shows. */
const ARTWORK_ASPECT = 1629 / 2160

/** What fraction of the picture a panel of this width reveals in a window of this height. */
function visible(window: { width: number; height: number }): number {
  return heroWidth(window) / (window.height * ARTWORK_ASPECT)
}

describe('how wide the artwork panel is', () => {
  it('keeps the desktop client’s share on a landscape window', () => {
    expect(heroWidth({ width: 1100, height: 760 })).toBe(440)
    expect(heroWidth({ width: 1210, height: 834 })).toBe(484)
  })

  it('gives a portrait window more, because the same share shows far less of the picture', () => {
    // The panel is full-height and the artwork's width follows from that, so a tall window crops
    // horizontally: at the landscape share a portrait iPad showed about a third of the picture.
    const portrait = { width: 834, height: 1210 }
    expect(visible(portrait)).toBeGreaterThan(0.45)
    expect(visible({ width: 1210, height: 834 })).toBeCloseTo(0.77, 1)
  })

  it('never takes the width the column needs', () => {
    // The column is fixed, so a hero that grew past this squeezes the heading and the buttons
    // rather than the picture. This is what stops portrait going wider than it does.
    for (const window of [
      { width: 834, height: 1210 },
      { width: 760, height: 1100 },
      { width: 720, height: 1000 },
    ]) {
      expect(window.width - heroWidth(window)).toBeGreaterThanOrEqual(COLUMN_WIDTH)
    }
  })

  it('stops growing on a very wide window', () => {
    expect(heroWidth({ width: 3000, height: 1200 })).toBe(640)
  })
})
