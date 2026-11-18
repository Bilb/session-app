import { test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp, type MobilePlatform } from '../harness/MobileApp'

// Throwaway: the conversation screen with its composer, for a before/after comparison.
for (const platform of ['android', 'ios'] as MobilePlatform[])
  for (const form of ['phone', 'tablet'] as const)
    test(`shoots the composer on a ${form} @${platform}`, async () => {
      const app = await MobileApp.launch(platform, 'alice', { form })
      try {
        await openFirstConversation(app)
        await app.waitForVisible(ELEMENT.conversation.attachButton)
        const frame = await app.frame(ELEMENT.conversation.attachButton)
        console.log(`frame ${platform} ${form} attach ${JSON.stringify(frame)} input ${JSON.stringify(await app.frame(ELEMENT.conversation.composerInput))} send ${JSON.stringify(await app.frame(ELEMENT.conversation.sendButton))}`)
        await app.screenshot(`shot-composer-${platform}-${form}`)
      } finally {
        await app.close()
      }
    })
