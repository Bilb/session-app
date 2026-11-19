import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp } from '../harness/MobileApp'

// Throwaway: the iOS tree round the footers, phone and tablet, default fixture and showcase.
for (const form of ['phone', 'tablet'] as const)
  for (const fixture of ['default', 'showcase'] as const)
    test(`dumps the tree on a ${form}, ${fixture} @ios`, async () => {
      const app = await MobileApp.launch('ios', 'alice', {
        form,
        ...(fixture === 'showcase' ? { env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' } } : {}),
      })
      try {
        await openFirstConversation(app)
        await app.waitForVisible(ELEMENT.conversation.attachmentFooter)
        const driver = (app as unknown as { driver: { getPageSource(): Promise<string> } }).driver
        const xml = await driver.getPageSource()
        writeFileSync(join(process.cwd(), '..', '..', 'test-results', `tree-${form}-${fixture}.xml`), xml)
        const lines = xml.split('\n').filter((l) => /XCUIElementTypeButton/.test(l) && /width="(3[0-9])"/.test(l))
        console.log(`tree ${form} ${fixture} small buttons: ${String(lines.length)}\n${lines.slice(0, 12).join('\n')}`)
      } finally {
        await app.close()
      }
    })
