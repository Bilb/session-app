import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * A message of ours whose 31st of 32 files failed to upload, from the showcase fixture: the only
 * way one reaches a screen while the bridge cannot send attachments.
 *
 * The failure is behind Show All, so the transcript has to say so; the sheet opens on it; and
 * Retry resumes the message rather than the file, which the fake does as libsession does.
 */
test('says a hidden upload failed, opens on it, and resumes the message on Retry @desktop @medium-risk', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-attachment-sending-'))
  const app = await _electron.launch({
    args: [
      join(repoRoot, 'apps/desktop/out/main/index.js'),
      `--user-data-dir=${dataDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    env: {
      ...process.env,
      ...FAKE_LAUNCH_ENV,
      EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase',
      SESSION_IDENTITY: 'alice',
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    await page.getByTestId(ELEMENT.conversationList.row(0)).first().click()
    await page.getByTestId(ELEMENT.conversation.screen).first().waitFor({ timeout: 25_000 })

    const message = page
      .getByTestId(/^message-row-\d+$/)
      .filter({ hasText: 'File 31 of 32 failed' })
    await message.scrollIntoViewIfNeeded()
    await expect(message.getByTestId(ELEMENT.conversation.attachmentState).last()).toHaveText(
      '30 of 32 uploaded',
    )
    await expect(message.getByTestId(ELEMENT.conversation.attachmentShowAllFailed)).toBeVisible()
    // One Retry, in the footer beside the count; the message's own line offers none of its own.
    await expect(message.getByTestId(ELEMENT.conversation.messageRetry)).toHaveCount(0)

    await message.getByTestId(ELEMENT.conversation.attachmentShowAll).click()
    const sheet = page.getByTestId(ELEMENT.conversation.attachmentSheet)
    await sheet.waitFor()
    await expect(sheet.getByText('Failed to send')).toBeVisible()
    await expect(sheet.getByText('Not sent')).toBeVisible()

    await sheet.getByTestId(ELEMENT.conversation.attachmentAction).click()
    await expect(sheet.getByText('Failed to send')).toHaveCount(0)
    await expect(sheet.getByText('30 of 32 uploaded')).toHaveCount(0)
  } finally {
    await app.close()
  }
})
