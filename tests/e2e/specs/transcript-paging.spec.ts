import { expect, test } from '@playwright/test'
import { PENDING_COPY } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import { SEEDED_REPLIES as REPLIES } from '../harness/fixtures'
import { launchLongConversation, messageSaying } from '../harness/longConversation'

const CONVERSATION = ELEMENT.conversation

test('opens a long conversation on its newest message @desktop @medium-risk', async () => {
  const app = await launchLongConversation()
  try {
    await expect(messageSaying(app, REPLIES.newest)).toBeInViewport({ ratio: 1 })
    await expect(app.locator(CONVERSATION.scrollToLatest)).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test('offers the way to the newest message once it is more than a screen away @desktop @medium-risk', async () => {
  const app = await launchLongConversation()
  try {
    const button = app.locator(CONVERSATION.scrollToLatest)
    await messageSaying(app, REPLIES.newest).hover()
    // Past the page it opened on: older pages are read in as the start comes into reach.
    for (let wheel = 0; wheel < 12; wheel++) await app.page.mouse.wheel(0, -600)
    await expect(button).toHaveAccessibleName(PENDING_COPY.messageScrollToLatest)
    await expect(messageSaying(app, REPLIES.newest)).not.toBeInViewport()

    await button.click()
    await expect(messageSaying(app, REPLIES.newest)).toBeInViewport({ ratio: 1 })
    await expect(button).toHaveCount(0)
  } finally {
    await app.close()
  }
})
