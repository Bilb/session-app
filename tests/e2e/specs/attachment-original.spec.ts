import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test, type ElectronApplication } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

async function answerSaveDialogWith(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, chosen) => {
    dialog.showSaveDialog = () => {
      dialog.showSaveDialog = () => Promise.reject(new Error('A save dialog nothing answered'))
      return Promise.resolve({ canceled: false, filePath: chosen })
    }
  }, path)
}

async function recordReveals(app: ElectronApplication): Promise<() => Promise<string[]>> {
  await app.evaluate(({ shell }) => {
    const global = globalThis as unknown as { sessionRevealed?: string[] }
    global.sessionRevealed = []
    shell.showItemInFolder = (revealed: string) => global.sessionRevealed?.push(revealed)
  })
  return () =>
    app.evaluate(
      () => (globalThis as unknown as { sessionRevealed?: string[] }).sessionRevealed ?? [],
    )
}

/**
 * Pictures their sender sent as the original files, from the showcase fixture: each draws its
 * thumbnail, and once it is here a tap exports it rather than opening the viewer, from an album
 * tile and from a list row alike.
 *
 * Message-scoped locators, and so Playwright directly rather than `sessionTest`: the showcase holds
 * every shape at once, and only the message's text says which tile belongs to which.
 */
test('exports a picture sent as the original file instead of opening it @desktop @medium-risk', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-attachment-original-'))
  const exportDir = mkdtempSync(join(tmpdir(), 'session2-export-'))
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
    const viewer = page.getByTestId(ELEMENT.conversation.mediaViewer)
    const revealed = await recordReveals(app)

    const album = page
      .getByTestId(/^message-row-\d+$/)
      .filter({ hasText: 'Two photos sent as the originals' })
    await album.scrollIntoViewIfNeeded()
    // Not here yet, so the tap fetches the set, asking first what this chat should fetch alone.
    await album.getByTestId(ELEMENT.conversation.attachmentTile).first().click()
    await page.getByTestId(ELEMENT.conversation.autoDownloadNo).click()
    await expect(album.getByTestId(ELEMENT.conversation.attachmentImage).first()).toBeVisible({
      timeout: 10_000,
    })

    const fromTile = join(exportDir, 'from-tile.jpg')
    await answerSaveDialogWith(app, fromTile)
    await album.getByTestId(ELEMENT.conversation.attachmentTile).first().click()
    await expect.poll(revealed, { timeout: 10_000 }).toEqual([fromTile])
    await expect(viewer).toBeHidden()

    const list = page
      .getByTestId(/^message-row-\d+$/)
      .filter({ hasText: 'A photo sent as the original, and the paperwork' })
    await list.scrollIntoViewIfNeeded()
    const photo = list.getByTestId(ELEMENT.conversation.attachmentName).first()
    await photo.click()
    await expect(list.getByTestId(ELEMENT.conversation.attachmentExport).first()).toBeVisible({
      timeout: 10_000,
    })

    const fromRow = join(exportDir, 'from-row.jpg')
    await answerSaveDialogWith(app, fromRow)
    await photo.click()
    await expect.poll(revealed, { timeout: 10_000 }).toEqual([fromTile, fromRow])
    await expect(viewer).toBeHidden()
  } finally {
    await app.close()
  }
})
