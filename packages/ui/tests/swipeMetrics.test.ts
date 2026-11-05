import { describe, expect, it } from 'vitest'

import { SWIPE_REPLY_THRESHOLD_PX, SWIPE_RESISTANCE, swipeDrawn } from '#src/swipeMetrics'

describe('how far a swiped row is drawn', () => {
  it('follows the thumb up to the threshold', () => {
    expect(swipeDrawn(30)).toBe(30)
    expect(swipeDrawn(SWIPE_REPLY_THRESHOLD_PX)).toBe(SWIPE_REPLY_THRESHOLD_PX)
  })

  it('resists past it, so the threshold is felt', () => {
    expect(swipeDrawn(SWIPE_REPLY_THRESHOLD_PX + 40)).toBe(
      SWIPE_REPLY_THRESHOLD_PX + 40 * SWIPE_RESISTANCE,
    )
  })

  it('does not move the other way, which is the back swipe’s', () => {
    expect(swipeDrawn(-50)).toBe(0)
  })
})
