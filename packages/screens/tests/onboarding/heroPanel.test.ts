import { describe, expect, it } from 'vitest'

import {
  COLUMN_RESERVE,
  COLUMN_WIDTH,
  HERO_FRACTION,
  HERO_MAX_WIDTH,
} from '#src/onboarding/heroPanel'

/**
 * What Yoga resolves the hero panel to, for a frame of this width.
 *
 * The split used to be a function in the source and is now three style properties -- a flex basis
 * and a maximum on the hero, a minimum on the column beside it -- so the rule they encode is
 * modelled here instead. Only the one case the chrome actually builds: two children, the first
 * `flexBasis: 40%, flexGrow: 0, flexShrink: 1, maxWidth: 640`, the second `flex: 1` with a
 * `minWidth`. The first is the only one that can give way, so overflow comes out of it.
 *
 * Kept as a test rather than dropped with the function because these numbers are the design's:
 * they were argued over on a real tablet, and a change to any of the three constants should have
 * to say so here.
 */
function heroWidth(frameWidth: number): number {
  const wanted = Math.min(frameWidth * HERO_FRACTION, HERO_MAX_WIDTH)
  const overflow = Math.max(0, wanted + COLUMN_RESERVE - frameWidth)
  return wanted - overflow
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

  it('never takes the width the column needs', () => {
    // The column is fixed, so a hero that grew past this squeezes the heading and the buttons
    // rather than the picture. It binds on a narrow window rather than on a tablet.
    for (const width of [834, 760, 720, 660]) {
      expect(width - heroWidth(width)).toBeGreaterThanOrEqual(COLUMN_WIDTH)
    }
  })

  it('stops growing on a very wide window', () => {
    expect(heroWidth(3000)).toBe(640)
  })
})
