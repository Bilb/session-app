import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * A start that fails lands on its own screen rather than leaving the launch screen up, and that
 * screen hands over libsession's message and the logs, asks before clearing anything, and recovers
 * in place.
 */
test('a failed start shows why, exports logs, asks before clearing, and recovers in place', async () => {
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

    // Export Logs writes one gzip file where the save dialog says, with the header on top and the
    // failed start in the log below it. The dialog is answered here, as a person would.
    const exported = join(dataDir, 'exported.log.gz')
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path })
    }, exported)
    await page.getByTestId(ELEMENT.startupFailed.exportLogs).first().click()
    await expect.poll(() => existsSync(exported), { timeout: 10_000 }).toBe(true)
    await expect(page.getByTestId(ELEMENT.startupFailed.exportLogs).first()).toBeEnabled()
    const text = gunzipSync(readFileSync(exported)).toString('utf8')
    expect(text).toMatch(/^=+\nSession logs exported /)
    expect(text).toContain('  Storage\n    Database       ')
    expect(text).toContain('>>> launch')
    expect(text).toContain('>>> start failed reason=')
    expect(text).toContain('>>> export')

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
