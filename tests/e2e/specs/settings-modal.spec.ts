import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * Settings opens over the list, walks into a child screen, comes back, and asks on top of itself.
 *
 * **The whole point of the spec is the two stacks interacting**, and nothing smaller can see it.
 * `modalStack.ts`'s unit tests cover the rules, but they are given a stack -- they cannot show that
 * pushing a screen and closing a nested modal leave the tree where it was. And a render test cannot
 * either: the host draws inside the platform's modal, which is where a mistake about what covers
 * what actually shows up.
 *
 * Four things are asserted in one pass rather than four specs, because each needs the state the one
 * before it left behind: a fresh launch per assertion would spend twenty seconds getting back to
 * where the last one finished.
 */
test('settings opens over the list, pushes Help, and asks on top of itself', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-settings-modal-'))
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
      SESSION_IDENTITY: 'alice',
      SESSION_DATA_DIR: dataDir,
    },
  })
  const page = await app.firstWindow()

  await page.getByTestId(ELEMENT.conversationList.screen).first().waitFor({ timeout: 25_000 })
  await page.getByTestId(ELEMENT.conversationList.settings).first().click()

  // The account ID is the one thing this screen exists to hand somebody, so it is what says the
  // screen arrived rather than the modal frame around it.
  await expect(page.getByTestId(ELEMENT.settings.accountId).first()).toBeVisible()
  // Nothing to go back to yet. A back control on a first screen is the classic off-by-one here.
  await expect(page.getByTestId(ELEMENT.settings.modalBack)).toHaveCount(0)

  await page.getByTestId(ELEMENT.settings.row('help')).first().click()
  await expect(page.getByTestId(ELEMENT.help.link('faq')).first()).toBeVisible()
  // One modal, one screen deeper: the control appears, and the root is gone rather than behind it.
  await expect(page.getByTestId(ELEMENT.settings.modalBack).first()).toBeVisible()
  await expect(page.getByTestId(ELEMENT.settings.accountId)).toHaveCount(0)

  await page.getByTestId(ELEMENT.settings.modalBack).first().click()
  await expect(page.getByTestId(ELEMENT.settings.accountId).first()).toBeVisible()
  await expect(page.getByTestId(ELEMENT.settings.modalBack)).toHaveCount(0)

  // A second modal over the first, which is the case the platform's own nesting gets wrong.
  await page.getByTestId(ELEMENT.settings.clearData).first().click()
  await expect(page.getByTestId(ELEMENT.settings.confirmClearDataButton).first()).toBeVisible()
  // **The settings screen is still mounted underneath.** Cancelling has to return to it, and it
  // can only do that by never having gone.
  await expect(page.getByTestId(ELEMENT.settings.accountId).first()).toBeVisible()

  await page.getByTestId(ELEMENT.settings.cancelClearData).first().click()
  await expect(page.getByTestId(ELEMENT.settings.confirmClearDataButton)).toHaveCount(0)
  await expect(page.getByTestId(ELEMENT.settings.accountId).first()).toBeVisible()

  // And closing leaves the list, not a blank pane -- settings was never a route.
  await page.getByTestId(ELEMENT.settings.modalClose).first().click()
  await expect(page.getByTestId(ELEMENT.settings.accountId)).toHaveCount(0)
  await expect(page.getByTestId(ELEMENT.conversationList.screen).first()).toBeVisible()

  await app.close()
})
