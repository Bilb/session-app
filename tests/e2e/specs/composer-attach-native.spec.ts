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

/** The menu's arrival, on a slow emulator. */
const OPEN_MS = 5_000

type Side = 'left' | 'right' | 'above' | 'below'

/** A point just outside one edge of the drawn button, where only its slop takes a touch. */
function besideEdge(button: Frame, side: Side): [number, number] {
  const centreX = button.x + button.width / 2
  const centreY = button.y + button.height / 2
  switch (side) {
    case 'left':
      return [button.x - OUTSIDE, centreY]
    case 'right':
      return [button.x + button.width + OUTSIDE, centreY]
    case 'above':
      return [centreX, button.y - OUTSIDE]
    case 'below':
      return [centreX, button.y + button.height + OUTSIDE]
  }
}

const SIDES: readonly Side[] = ['left', 'right', 'above', 'below']

/**
 * Launched directly, because a touch at a point outside an element is not in `ISessionApp`. A
 * launch per side: iOS drops a menu presented while the last one is still dismissing.
 */
for (const platform of MOBILE_PLATFORMS)
  for (const side of SIDES)
    test(`opens the attach menu from a touch just ${side} the drawn button @${platform} @medium-risk`, async () => {
      const app = await MobileApp.launch(platform, 'alice')
      try {
        await openFirstConversation(app)
        const button = await app.frame(ELEMENT.conversation.attachButton)
        if (button === null) throw new Error('no attach button')
        // Otherwise the touch could land on the button itself and prove nothing.
        expect(Math.abs(button.width - DRAWN)).toBeLessThanOrEqual(ROUNDING)
        expect(Math.abs(button.height - DRAWN)).toBeLessThanOrEqual(ROUNDING)

        const [x, y] = besideEdge(button, side)
        await app.tapPoint(x, y)
        await app.waitForVisible(ELEMENT.conversation.attachMenu, { timeoutMs: OPEN_MS })
      } finally {
        await app.close()
      }
    })
