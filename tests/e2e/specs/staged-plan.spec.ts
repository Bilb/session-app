import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/** The page's own globals, which the e2e package is typed without. */
interface PageGlobals {
  requestIdleCallback: (callback: () => void) => number
}

/** An 8x8 JPEG, whole. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiqKKK8A/Wz//Z',
  'base64',
)

async function launch(dataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
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
  const page = await app.firstWindow()
  await page.getByTestId(ELEMENT.conversationList.row(0)).first().click()
  await page.getByTestId(ELEMENT.conversation.screen).first().waitFor({ timeout: 25_000 })
  return { app, page }
}

async function pick(page: Page, ...paths: string[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId(ELEMENT.conversation.attachButton).click()
  await (await chooser).setFiles(paths)
}

function sized(dataDir: string, name: string, sizeBytes: number): string {
  const path = join(dataDir, name)
  writeFileSync(path, '')
  truncateSync(path, sizeBytes)
  return path
}

/**
 * Staging asks libsession's plan for each file, and a file it will not send is turned away there,
 * by name, while the rest of the pick is staged. The limit holds on the encrypted upload, so a
 * file a byte past what encrypts to fit is refused though its own size is under the limit.
 */
test('refuses a non-picture over the file server limit by name, and stages the rest @desktop @medium-risk', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-staged-plan-'))
  try {
    const over = sized(dataDir, 'holiday-footage.zip', 9_956_279)
    const fits = sized(dataDir, 'boarding-passes.zip', 9_956_278)
    const { app, page } = await launch(dataDir)
    try {
      await pick(page, over, fits)
      const notice = page.getByTestId(ELEMENT.conversation.composerNotice('size'))
      await expect(notice).toContainText('holiday-footage.zip')
      await expect(notice).not.toContainText('boarding-passes.zip')
      await expect(page.getByTestId(ELEMENT.conversation.stagedTile(0))).toContainText(
        'boarding-passes.zip',
      )
      await expect(page.getByTestId(ELEMENT.conversation.stagedTile(1))).toHaveCount(0)
      await expect(page.getByTestId(ELEMENT.conversation.sendButton)).toBeEnabled()
    } finally {
      await app.close()
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

/**
 * A staged picture's preview is fetched while it is staged, and nothing asks for it once the send
 * that hands it off has taken its grant away.
 */
test('fetches a staged preview once, and not again after the send @desktop @medium-risk', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-staged-preview-'))
  const photo = join(dataDir, 'unsplash-07.jpg')
  writeFileSync(photo, JPEG)
  const { app, page } = await launch(dataDir).catch((error: unknown) => {
    rmSync(dataDir, { recursive: true, force: true })
    throw error
  })
  try {
    // Every fetch of a picked url the window makes, with what main answered.
    await app.evaluate(({ BrowserWindow }) => {
      const seen: number[] = []
      ;(globalThis as { pickedFetches?: number[] }).pickedFetches = seen
      BrowserWindow.getAllWindows()[0]?.webContents.session.webRequest.onCompleted(
        { urls: ['session-media://picked/*'] },
        ({ statusCode }) => seen.push(statusCode),
      )
    })
    const fetches = () =>
      app.evaluate(() => [...((globalThis as { pickedFetches?: number[] }).pickedFetches ?? [])])
    await pick(page, photo)
    await expect(page.getByTestId(ELEMENT.conversation.stagedTile(0))).toBeVisible()
    await expect.poll(async () => (await fetches()).length).toBeGreaterThan(0)
    // The image loader and the drawn element may each fetch it once; what matters is no more.
    const drawn = await fetches()

    const input = page.getByTestId(ELEMENT.conversation.composerInput)
    await input.pressSequentially('a caption')
    await page.getByTestId(ELEMENT.conversation.sendButton).click()
    await expect(page.getByTestId(ELEMENT.conversation.stagedTray)).toHaveCount(0)
    // The sent message drawn and the renderer idle after it: whatever that render asks for is out.
    await expect(
      page.getByTestId(/^message-row-\d+$/).filter({ hasText: 'a caption' }),
    ).toBeVisible()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const { requestIdleCallback } = globalThis as unknown as PageGlobals
          requestIdleCallback(() => {
            resolve()
          })
        }),
    )
    expect(await fetches()).toEqual(drawn)
    expect(drawn.every((status) => status === 200)).toBe(true)
  } finally {
    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
})
