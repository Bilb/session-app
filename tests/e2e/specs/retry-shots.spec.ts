import { test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp, type MobilePlatform } from '../harness/MobileApp'

// Throwaway: a failed send's bubble, for a before/after comparison.
for (const platform of ['android', 'ios'] as MobilePlatform[])
  test(`shoots a failed send @${platform}`, async () => {
    const app = await MobileApp.launch(platform, 'alice', { env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' } })
    try {
      await openFirstConversation(app)
      const failed = async () => (await app.readAllText(ELEMENT.conversation.messageBody)).findIndex((l) => l.includes('Only text, and it failed'))
      for (const direction of [1, -1] as const)
        for (let swipe = 0; swipe < 12 && (await failed()) < 0; swipe++)
          if (!(await app.scroll(ELEMENT.conversation.screen, direction))) break
      const at = await failed()
      const states = await app.readAllText(ELEMENT.conversation.messageState)
      console.log(`state ${platform} at ${String(at)} ${JSON.stringify(states)} retry ${JSON.stringify(await app.frame(ELEMENT.conversation.messageRetry))}`)
      await app.screenshot(`shot-retry-${platform}`)
    } finally {
      await app.close()
    }
  })
