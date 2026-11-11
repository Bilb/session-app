import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test, type ElectronApplication } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * Help > Keyboard Shortcuts, the menu item Ctrl+/ chooses. Playwright's keys go to the page and
 * never pass the native menu's accelerators, so it is chosen as a click on the menu would.
 */
async function chooseFromHelpMenu(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const help = Menu.getApplicationMenu()?.items.find((menu) => menu.role === 'help')
    const item = help?.submenu?.items.find((candidate) => candidate.accelerator === 'CmdOrCtrl+/')
    if (item === undefined) throw new Error('no Keyboard Shortcuts in the Help menu')
    item.click(undefined, BrowserWindow.getAllWindows()[0], undefined)
  })
}

/**
 * The menu command reaching the page, which only the running app has: it opens the list and closes
 * it, and Help in settings opens it too. Linux names the keys as a PC does; the Mac's names are the
 * catalog's.
 */
test('the Help menu and Help in settings open the keyboard shortcuts @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-keyboard-shortcuts-'))
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
      SESSION_IDENTITY: 'alice',
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    await page.getByTestId(ELEMENT.conversationList.screen).first().waitFor({ timeout: 25_000 })
    const list = page.getByTestId(ELEMENT.keyboardShortcuts.page)

    await chooseFromHelpMenu(app)
    await expect(list.first()).toBeVisible()
    await expect(page.getByTestId(ELEMENT.keyboardShortcuts.combo('menu', 0)).first()).toHaveText(
      'Enter',
    )
    await expect(
      page.getByTestId(ELEMENT.keyboardShortcuts.combo('full-screen', 0)).first(),
    ).toHaveText('F11')
    await chooseFromHelpMenu(app)
    await expect(list).toHaveCount(0)

    await page.getByTestId(ELEMENT.rail.settings).first().click()
    await page.getByTestId(ELEMENT.settings.row('help')).first().click()
    const row = page.getByTestId(ELEMENT.help.keyboardShortcuts).first()
    await expect(row).toContainText('Ctrl/')
    await row.click()
    await expect(list.first()).toBeVisible()
    await page.getByTestId(ELEMENT.settings.modalBack).first().click()
    await expect(page.getByTestId(ELEMENT.help.keyboardShortcuts).first()).toBeVisible()
  } finally {
    await app.close()
  }
})
