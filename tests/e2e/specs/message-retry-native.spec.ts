import { expect, test } from '@playwright/test'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp, type MobilePlatform } from '../harness/MobileApp'

const MOBILE_PLATFORMS: readonly MobilePlatform[] = ['android', 'ios']

/** Swipes, each way, before a failed send counts as not in the conversation. */
const MAX_SWIPES = 12

/** A send's way back through the fake's queue. */
const SENT_MS = 15_000

async function failedLines(app: MobileApp): Promise<number> {
  const lines = await app.readAllText(ELEMENT.conversation.messageState)
  return lines.filter((line) => line.includes(tr('tapToRetry'))).length
}

/** Scrolls the showcase until a failed send's state line is on screen. */
async function revealFailed(app: MobileApp): Promise<void> {
  for (const direction of [1, -1] as const)
    for (let swipe = 0; swipe < MAX_SWIPES; swipe++) {
      if ((await failedLines(app)) > 0) return
      if (!(await app.scroll(ELEMENT.conversation.screen, direction))) break
    }
  throw new Error('no failed send in the showcase')
}

/**
 * Launched directly, because the bubble's press is not an element of its own: the touch goes to
 * the state line, as a finger on any part of the bubble would.
 */
for (const platform of MOBILE_PLATFORMS)
  test(`retries a failed send from a touch on its bubble @${platform} @medium-risk`, async () => {
    const app = await MobileApp.launch(platform, 'alice', {
      env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' },
    })
    try {
      await openFirstConversation(app)
      await revealFailed(app)
      const before = await failedLines(app)
      const lines = await app.readAllText(ELEMENT.conversation.messageState)
      await app.tapAt(
        ELEMENT.conversation.messageState,
        lines.findIndex((line) => line.includes(tr('tapToRetry'))),
      )
      await expect.poll(() => failedLines(app), { timeout: SENT_MS }).toBeLessThan(before)
    } finally {
      await app.close()
    }
  })
