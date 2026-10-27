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

/**
 * Downloads one file by tapping its row rather than its control, first in the conversation, and
 * waits until it is the one row offering Export. Returns where its name sits among the rows'.
 */
export async function downloadFromRow(app: ISessionApp, filename: string): Promise<number> {
  const at = (await app.readAllText(ELEMENT.conversation.attachmentName)).indexOf(filename)
  if (at < 0) throw new Error(`no row is named ${filename}`)
  // The name rather than the row's own id, which the album above the rows carries too.
  await app.tapAt(ELEMENT.conversation.attachmentName, at)
  await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  await app.tap(ELEMENT.conversation.autoDownloadNo)
  await expect
    .poll(async () => app.count(ELEMENT.conversation.attachmentExport), { timeout: 10_000 })
    .toBe(1)
  // The prompt fades rather than going, and a tap on the row under it would land on its scrim.
  await expect
    .poll(async () => app.isVisible(ELEMENT.conversation.autoDownloadPrompt), { timeout: 5_000 })
    .toBe(false)
  return at
}
