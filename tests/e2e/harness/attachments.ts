import { expect } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import type { ISessionApp } from './ISessionApp'

/** Opens the top conversation from the list, which is Bob's, where the attachments are seeded. */
export async function openFirstConversation(app: ISessionApp): Promise<void> {
  await app.waitForVisible(ELEMENT.conversationList.screen)
  await app.tap(ELEMENT.conversationList.row(0))
  await app.waitForVisible(ELEMENT.conversation.screen)
}

/**
 * Downloads the first list row's file and waits until it offers Export.
 *
 * The first download in a conversation asks about auto-download; this answers No, so nothing
 * else in the conversation starts fetching behind the spec's back.
 */
export async function downloadFirstAttachment(app: ISessionApp): Promise<void> {
  await app.tap(ELEMENT.conversation.attachmentDownload)
  await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  await app.tap(ELEMENT.conversation.autoDownloadNo)
  await expect
    .poll(async () => app.isVisible(ELEMENT.conversation.attachmentExport), { timeout: 10_000 })
    .toBe(true)
}
