import { expect } from '@playwright/test'
import { verbName } from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import type { ISessionApp } from './ISessionApp'

/** Opens the top conversation from the list, which is Bob's, where the attachments are seeded. */
export async function openFirstConversation(app: ISessionApp): Promise<void> {
  await app.waitForVisible(ELEMENT.conversationList.screen)
  await app.tap(ELEMENT.conversationList.row(0))
  await app.waitForVisible(ELEMENT.conversation.screen)
}

/**
 * How many controls offer Export: each row's, and the footer's verb of a message with one
 * attachment, whose row has no control of its own.
 */
export async function exportsOffered(app: ISessionApp): Promise<number> {
  const footers = await app.count(ELEMENT.conversation.attachmentAction)
  let exporting = 0
  for (let at = 0; at < footers; at++)
    if (
      (await app.describe(ELEMENT.conversation.attachmentAction, at))?.name === verbName('export')
    )
      exporting += 1
  return (await app.count(ELEMENT.conversation.attachmentExport)) + exporting
}

/**
 * Downloads the first list row's file and waits until it offers Export: through the row's control
 * where rows carry one, and otherwise through the footer's verb, which is a lone file's only one.
 *
 * The first download in a conversation asks about auto-download; this answers No, so nothing
 * else in the conversation starts fetching behind the spec's back.
 */
export async function downloadFirstAttachment(app: ISessionApp): Promise<void> {
  const before = await exportsOffered(app)
  const onRow = (await app.count(ELEMENT.conversation.attachmentDownload)) > 0
  await app.tap(
    onRow ? ELEMENT.conversation.attachmentDownload : ELEMENT.conversation.attachmentAction,
  )
  await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  await app.tap(ELEMENT.conversation.autoDownloadNo)
  await expect.poll(async () => exportsOffered(app), { timeout: 10_000 }).toBeGreaterThan(before)
}

/**
 * Downloads one file by tapping its row rather than its control, first in the conversation, and
 * waits until it is the one file offering Export, on its row or, for a lone file, in its footer.
 * Returns where its name sits among the rows'.
 */
export async function downloadFromRow(app: ISessionApp, filename: string): Promise<number> {
  const at = (await app.readAllText(ELEMENT.conversation.attachmentName)).indexOf(filename)
  if (at < 0) throw new Error(`no row is named ${filename}`)
  // The name rather than the row's own id, which the album above the rows carries too.
  await app.tapAt(ELEMENT.conversation.attachmentName, at)
  await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  await app.tap(ELEMENT.conversation.autoDownloadNo)
  await expect.poll(async () => exportsOffered(app), { timeout: 10_000 }).toBe(1)
  // The prompt fades rather than going, and a tap on the row under it would land on its scrim.
  await expect
    .poll(async () => app.isVisible(ELEMENT.conversation.autoDownloadPrompt), { timeout: 5_000 })
    .toBe(false)
  return at
}
