import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { _electron, expect, test, type Page } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/** Export Logs is under the step's action, not beside it or above it. */
async function expectUnderContinue(page: Page): Promise<void> {
  const action = await page.getByTestId(ELEMENT.onboarding.continueButton).first().boundingBox()
  const logs = await page.getByTestId(ELEMENT.onboarding.exportLogs).first().boundingBox()
  if (action === null || logs === null) throw new Error('Continue or Export Logs is not drawn')
  expect(logs.y, 'Export Logs starts below Continue').toBeGreaterThanOrEqual(
    action.y + action.height,
  )
}

/**
 * Onboarding offers Export Logs under each step's action, on the steps where an account is made
 * or restored and can go wrong with nothing on screen saying why, and it exports from there.
 */
test('onboarding offers Export Logs under each step’s action @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-onboarding-logs-'))
  const app = await _electron.launch({
    args: [
      join(repoRoot, 'apps/desktop/out/main/index.js'),
      `--user-data-dir=${dataDir}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    env: { ...process.env, ...FAKE_LAUNCH_ENV, EXPO_PUBLIC_SESSION_NO_ACCOUNT: '1' },
  })
  try {
    const page = await app.firstWindow()

    // The landing screen has no single action to sit under.
    await page.getByTestId(ELEMENT.onboarding.createAccount).first().waitFor({ timeout: 20_000 })
    await expect(page.getByTestId(ELEMENT.onboarding.exportLogs)).toHaveCount(0)

    await page.getByTestId(ELEMENT.onboarding.restoreAccount).first().click()
    await expect(page.getByTestId(ELEMENT.onboarding.loadAccountScreen).first()).toBeVisible()
    await expectUnderContinue(page)

    await page.getByTestId(ELEMENT.onboarding.back).first().click()
    await page.getByTestId(ELEMENT.onboarding.createAccount).first().click()
    await expect(page.getByTestId(ELEMENT.onboarding.displayNameScreen).first()).toBeVisible()
    await expectUnderContinue(page)

    // The save dialog is answered here, as a person would.
    const exported = join(dataDir, 'exported.log.gz')
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path })
    }, exported)
    await page.getByTestId(ELEMENT.onboarding.exportLogs).first().click()
    await expect.poll(() => existsSync(exported), { timeout: 10_000 }).toBe(true)
    await expect(page.getByTestId(ELEMENT.onboarding.exportLogs).first()).toBeEnabled()
    const text = gunzipSync(readFileSync(exported)).toString('utf8')
    expect(text).toMatch(/^=+\nSession logs exported /)
    expect(text).toContain('>>> export')
  } finally {
    await app.close()
  }
})
