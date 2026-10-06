import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * A start that fails lands on its own screen rather than leaving the launch screen up, and that
 * screen hands over libsession's message, asks before clearing anything, and recovers in place.
 */
test('a failed start shows why, copies it, asks before clearing, and recovers in place', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-startup-failed-'))
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
      ELECTRON_RUN_AS_NODE: '',
      EXPO_PUBLIC_SESSION_FAKE: '1',
      SESSION_FAKE_FAILED_START: '1',
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible({
      timeout: 20_000,
    })

    // Export Logs is there in its final place, and disabled until the app keeps logs.
    await expect(page.getByTestId(ELEMENT.startupFailed.exportLogs).first()).toBeDisabled()

    // The reason is libsession's own message, and the control beside it puts exactly that on the
    // clipboard for support.
    const reason = page.getByTestId(ELEMENT.startupFailed.reason).first()
    await expect(reason).toContainText('the bridge has no database open: file is not a database')
    await page.getByTestId(ELEMENT.startupFailed.copyReason).first().click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe(await reason.textContent())
    await expect(page.getByTestId(ELEMENT.toast.item).first()).toHaveText('Copied')
    await page.getByTestId(ELEMENT.toast.close).first().click()

    // Clearing asks first, with a Cancel that leaves everything where it was.
    await page.getByTestId(ELEMENT.startupFailed.clear).first().click()
    await expect(page.getByTestId(ELEMENT.startupFailed.confirmClearButton).first()).toBeVisible()
    await page.getByTestId(ELEMENT.startupFailed.cancelClear).first().click()
    await expect(page.getByTestId(ELEMENT.startupFailed.confirmClear)).toHaveCount(0)
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible()

    // Clearing for real replaces the database in place, and with no account on it the app goes
    // straight to onboarding -- no restart.
    await page.getByTestId(ELEMENT.startupFailed.clear).first().click()
    await page.getByTestId(ELEMENT.startupFailed.confirmClearButton).first().click()
    await expect(page.getByTestId(ELEMENT.onboarding.createAccount).first()).toBeVisible()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen)).toHaveCount(0)
  } finally {
    await app.close()
  }
})
