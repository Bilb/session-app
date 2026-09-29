import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

const repoRoot = join(import.meta.dirname, '../../..')

interface PageGlobals {
  sessionDesktop: { copyText(text: string): Promise<void> }
}

/**
 * The renderer is refused every permission, so a copy reaches the clipboard only through the main
 * process, and only just after a real click or key press. Both halves are observable only in the
 * app: the permission handlers and the input tracking live in main.
 */
test('copies a URL after a click, and refuses a copy nobody asked for', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-copy-url-'))
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
      SESSION_FAKE: '1',
      SESSION_FAKE_NO_ACCOUNT: '1',
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    const readClipboard = () => app.evaluate(({ clipboard }) => clipboard.readText())

    await page.getByTestId(ELEMENT.onboarding.faqLink).first().waitFor({ timeout: 20_000 })
    await app.evaluate(({ clipboard }) => clipboard.writeText('untouched'))

    const unasked = await page.evaluate(() =>
      (globalThis as unknown as PageGlobals).sessionDesktop.copyText('planted').then(
        () => 'written',
        () => 'refused',
      ),
    )
    expect(unasked).toBe('refused')
    expect(await readClipboard()).toBe('untouched')

    await page.getByTestId(ELEMENT.onboarding.faqLink).first().click()
    await page.getByTestId(ELEMENT.onboarding.copyUrl).first().click()

    await expect.poll(readClipboard).toMatch(/^https:\/\/\S+/)
  } finally {
    await app.close()
  }
})
