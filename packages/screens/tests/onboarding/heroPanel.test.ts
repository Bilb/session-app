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

  it('gives a portrait window the same share, not a larger one', () => {
    // It had a larger share for a while. Most of what looked wrong in portrait was the artwork
    // being sized from its file rather than from its panel; with that fixed, a wider panel only
    // takes room from the content, which is the part that matters on this screen.
    expect(heroWidth({ width: 834, height: 1210 })).toBe(834 * 0.4)
    expect(visible({ width: 1210, height: 834 })).toBeCloseTo(0.77, 1)
  })

  it('never takes the width the column needs', () => {
    // The column is fixed, so a hero that grew past this squeezes the heading and the buttons
    // rather than the picture. It binds on a narrow window rather than on a tablet.
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
