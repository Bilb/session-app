import { describe, expect, it } from 'vitest'

import {
  COLUMN_RESERVE,
  COLUMN_WIDTH,
  HERO_FRACTION,
  HERO_MAX_WIDTH,
} from '#src/onboarding/heroPanel'

/** The narrowest window this branch is ever asked to lay out: tamagui's `gtSm` starts here. */
const WIDE_FROM = 701

/**
 * What Yoga resolves the hero panel to, for a frame of this width.
 *
 * The split used to be a function in the source and is now style properties, so the rule they
 * encode is modelled here instead. Only the one case the chrome actually builds: two children
 * with a zero flex basis, growing 2 and 3, the first capped at `HERO_MAX_WIDTH`. Free space is
 * the whole frame and it is shared in that ratio, which is why this is one line.
 *
 * **There is deliberately no minimum on the column any more**, and the modelling of one is what
 * this function used to spend three lines on. Yoga clamps a flex base size up to the minimum
 * before it works out the free space, so a floor that never binds still comes off the top of
 * every layout -- on an iPad it made the hero a flat 159 short at every width, which is 0.4 x 398.
 * The rule it stated is true by construction now, and `keeps the column above what it reserves`
 * below is what holds us to it.
 *
 * Kept as a test rather than dropped with the function because these numbers are the design's:
 * they were argued over on a real tablet, and a change to any of the constants should have to say
 * so here.
 */
function heroWidth(frameWidth: number): number {
  return Math.min(frameWidth * HERO_FRACTION, HERO_MAX_WIDTH)
}

/** The artwork is this much wider than it is tall, so a panel's width says how much of it shows. */
const ARTWORK_ASPECT = 1629 / 2160

/** What fraction of the picture a panel of this width reveals in a window of this height. */
function visible(window: { width: number; height: number }): number {
  return heroWidth(window.width) / (window.height * ARTWORK_ASPECT)
}

describe('how wide the artwork panel is', () => {
  it('keeps the desktop client’s share on a landscape window', () => {
    expect(heroWidth(1100)).toBe(440)
    expect(heroWidth(1210)).toBe(484)
  })

  it('gives a portrait window the same share, not a larger one', () => {
    // It had a larger share for a while. Most of what looked wrong in portrait was the artwork
    // being sized from its file rather than from its panel; with that fixed, a wider panel only
    // takes room from the content, which is the part that matters on this screen.
    expect(heroWidth(834)).toBe(834 * 0.4)
    expect(visible({ width: 1210, height: 834 })).toBeCloseTo(0.77, 1)
  })

  it('keeps the column above what it reserves, at every width this branch sees', () => {
    // What the column's `minWidth` used to say, asserted instead of enforced -- because enforcing
    // it cost more than it was worth. Three fifths of the narrowest wide window is already clear
    // of the reserve, and the hero's cap only widens the gap from there.
    for (let width = WIDE_FROM; width <= 3000; width += 1) {
      expect(width - heroWidth(width)).toBeGreaterThanOrEqual(COLUMN_RESERVE)
    }
  })

  it('leaves room for the column itself, not merely for its reserve', () => {
    for (const width of [WIDE_FROM, 834, 1100, 1210, 3000]) {
      expect(width - heroWidth(width)).toBeGreaterThanOrEqual(COLUMN_WIDTH)
    }
  })

  it('stops growing on a very wide window', () => {
    expect(heroWidth(3000)).toBe(640)
  })
})
