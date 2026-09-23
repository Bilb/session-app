import { describe, expect, it } from 'vitest'

import { bubbleMaxWidth } from '#src/onboarding/landingBubble'

/**
 * Android's rule, against the container the conversation is actually in -- which both clients
 * inset by 36 either side. iOS caps at a flat 230 instead, which against its own container is 93%
 * on an iPhone SE and 62% on a 16 Pro Max; the share exists so that it is neither.
 */
describe('how wide a landing bubble may be', () => {
  /** Our own inset is 35 a side, so this is what the conversation gets on a phone that wide. */
  const container = (screen: number) => screen - 70

  it('sits between the two clients at every phone size', () => {
    // iOS's flat 230 and Android's 80% of a 36-inset container, for the same screens.
    expect(bubbleMaxWidth(container(375))).toBeCloseTo(229, 0)
    expect(bubbleMaxWidth(container(402))).toBeCloseTo(249, 0)
    expect(bubbleMaxWidth(container(440))).toBeCloseTo(277.5, 1)
    for (const screen of [375, 402, 440]) {
      const ours = bubbleMaxWidth(container(screen))
      expect(ours).toBeLessThan((screen - 72) * 0.8)
    }
  })

  it('holds the floor on a small phone, where three quarters is narrower than either client', () => {
    // An SE's container is 250 and 75% of it is 188, which is under both clients.
    expect(bubbleMaxWidth(container(320))).toBe(200)
  })

  it('stops growing in a very wide container', () => {
    expect(bubbleMaxWidth(2000)).toBe(500)
  })

  it('never exceeds its container', () => {
    for (const width of [250, 305, 332, 370, 348]) {
      expect(bubbleMaxWidth(width)).toBeLessThanOrEqual(width)
    }
  })
})
