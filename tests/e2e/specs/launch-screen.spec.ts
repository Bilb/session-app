import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'
import { DEFAULT_ACCENT, DEFAULT_THEME, getThemeTokens } from '@session/theme-tokens'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * The window opens in the default theme with the brand mark on it, rather than white, and the
 * mark goes once the app has drawn.
 */
test('the window opens on the launch screen, which goes once the app draws', async () => {
  const { backgroundPrimary, primaryColor } = getThemeTokens(DEFAULT_THEME, DEFAULT_ACCENT)

  // The page as built: the launch screen is in the HTML, so it draws with the first frame rather
  // than when the script arrives -- which is too soon after load for a test to catch it on screen.
  const html = readFileSync(join(repoRoot, 'apps/desktop/out/renderer/index.html'), 'utf8')
  expect(html).toContain('<div id="launch-screen"')
  expect(html).toContain(`background: ${backgroundPrimary}`)
  expect(html).toContain(`fill="${primaryColor}"`)

  const dataDir = mkdtempSync(join(tmpdir(), 'session-launch-screen-'))
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
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    // What shows before the page has drawn anything at all.
    const windowColor = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getBackgroundColor(),
    )
    expect(windowColor?.toUpperCase()).toBe(backgroundPrimary.toUpperCase())

    await expect(page.getByTestId(ELEMENT.conversationList.screen).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('#launch-screen')).toHaveCount(0)
  } finally {
    await app.close()
  }
})
