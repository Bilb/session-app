import { expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import type { Frame } from '../harness/ISessionApp'
import { MobileApp, type MobilePlatform } from '../harness/MobileApp'

const MOBILE_PLATFORMS: readonly MobilePlatform[] = ['android', 'ios']

// @session/ui's buttonHeight('md'): importing ui would pull react-native into Playwright.
const DRAWN = 40

/** How far outside the drawn button a touch lands: inside the slop, which reaches 4 on each side. */
const OUTSIDE = 2

/** iOS's tree gives each frame in whole points. */
const ROUNDING = 1

/** The menu's dismissal, on a slow emulator. */
const CLOSE_MS = 5_000

/** A point just outside each edge of the drawn button, where only its slop takes a touch. */
function besideEachEdge(button: Frame): Array<[string, number, number]> {
  const centreX = button.x + button.width / 2
  const centreY = button.y + button.height / 2
  return [
    ['left', button.x - OUTSIDE, centreY],
    ['right', button.x + button.width + OUTSIDE, centreY],
    ['above', centreX, button.y - OUTSIDE],
    ['below', centreX, button.y + button.height + OUTSIDE],
  ]
}

/** Launched directly, because a touch at a point outside an element is not in `ISessionApp`. */
for (const platform of MOBILE_PLATFORMS) {
  test(`opens the attach menu from a touch just outside the drawn button @${platform} @medium-risk`, async () => {
    const app = await MobileApp.launch(platform, 'alice')
    try {
      await openFirstConversation(app)
      const button = await app.frame(ELEMENT.conversation.attachButton)
      if (button === null) throw new Error('no attach button')
      // Otherwise the touches below could land on the button itself and prove nothing.
      expect(Math.abs(button.width - DRAWN)).toBeLessThanOrEqual(ROUNDING)
      expect(Math.abs(button.height - DRAWN)).toBeLessThanOrEqual(ROUNDING)

      for (const [side, x, y] of besideEachEdge(button)) {
        await app.tapPoint(x, y)
        await app
          .waitForVisible(ELEMENT.conversation.attachMenu, { timeoutMs: CLOSE_MS })
          .catch(() => {
            throw new Error(`a touch ${side} the drawn button opened nothing`)
          })
        await app.tap(ELEMENT.conversation.attachMenuClose)
        await expect
          .poll(() => app.isVisible(ELEMENT.conversation.attachMenu), {
            timeout: CLOSE_MS,
          })
          .toBe(false)
      }
    } finally {
      await app.close()
    }
  })
}
