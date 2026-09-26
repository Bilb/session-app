import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { downloadFirstAttachment, openFirstConversation } from '../harness/attachments'
import { DesktopApp } from '../harness/DesktopApp'
import { SEEDED_LIST } from '../harness/fixtures'

/**
 * Exporting a file that is already here, as far as main revealing where it landed.
 *
 * Launched directly rather than through `sessionTest` because answering a save dialog is
 * desktop-only - the same reason the performance specs do - and only the chooser is replaced.
 * Everything after it is real: the IPC, the folder the main process remembers before it will
 * reveal anything in it, and the bridge writing the file.
 *
 * What is asserted is the reveal, not bytes on disk: the fake holds no file to write, so a
 * filesystem check here would be measuring the fake rather than the app. A reveal that happened
 * is an export that got a destination, crossed the IPC, reached the bridge, came back with a
 * path, and was let through by the folder the main process remembered from the dialog.
 */
test('exports an attachment to a folder somebody chose @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  // The first download control belongs to the list's first row.
  const destination = join(mkdtempSync(join(tmpdir(), 'session2-export-')), SEEDED_LIST[0])

  try {
    await openFirstConversation(app)

    // Export is only offered for bytes we hold, so the file has to arrive first.
    await downloadFirstAttachment(app)

    await app.recordReveals()
    await app.answerSaveDialogWith(destination)
    await app.tap(ELEMENT.conversation.attachmentExport)

    await expect.poll(async () => app.revealedPaths(), { timeout: 10_000 }).toEqual([destination])
  } finally {
    await app.close()
  }
})

/**
 * The same tap, answered by somebody who changed their mind.
 *
 * Its own scenario because the cancel path is the one that runs whenever a person hesitates, and
 * an export that treated a dismissed dialog as a destination would write to whatever the empty
 * string resolves to.
 */
test('writes nothing when the save dialog is dismissed @desktop @low-risk', async () => {
  const app = await DesktopApp.launch('alice')

  try {
    await openFirstConversation(app)

    await downloadFirstAttachment(app)

    await app.recordReveals()
    await app.cancelNextSaveDialog()
    await app.tap(ELEMENT.conversation.attachmentExport)

    // The row is still there and still offering, which is the whole of what should have happened.
    await expect
      .poll(async () => app.isVisible(ELEMENT.conversation.attachmentExport), { timeout: 5_000 })
      .toBe(true)
    expect(await app.revealedPaths()).toEqual([])
  } finally {
    await app.close()
  }
})
