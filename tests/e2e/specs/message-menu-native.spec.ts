import { expect, test } from '@playwright/test'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp, type MobilePlatform } from '../harness/MobileApp'

const MOBILE_PLATFORMS: readonly MobilePlatform[] = ['android', 'ios']
const MENU = ELEMENT.contextMenu
/** The modal's dismissal, on a slow emulator. */
const CLOSE_MS = 5_000

/** Launched directly, because a long press is a gesture `ISessionApp` does not offer. */
for (const platform of MOBILE_PLATFORMS) {
  test(`opens a message’s menu on a long press, and closes it from a row @${platform} @medium-risk`, async () => {
    const app = await MobileApp.launch(platform, 'alice')
    try {
      await openFirstConversation(app)
      await app.longPress(ELEMENT.conversation.messageBody)
      await app.waitForVisible(MENU.menu)
      expect(await app.readText(MENU.item('copy'))).toBe(tr('copy'))
      expect(await app.isDisabled(MENU.item('reply'))).toBe(true)

      await app.tap(MENU.item('copy'))
      await expect.poll(() => app.isVisible(MENU.menu), { timeout: CLOSE_MS }).toBe(false)
    } finally {
      await app.close()
    }
  })
}
