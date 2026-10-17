import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { stagedThumbnailUrl } from '@session/app/mediaUrl'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/**
 * An 8x8 JPEG, whole, so the spec holds against libsession's decoder as well as the fake, which
 * answers a dev photograph's name with that photograph's thumbnail.
 */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiqKKK8A/Wz//Z',
  'base64',
)

/** What the page code below reaches, since the specs compile without the DOM library. */
interface PageGlobals {
  document: {
    createElement(tag: 'input'): { type: string; id: string }
    getElementById(id: string): { files: readonly unknown[] | null } | null
    body: { append(node: unknown): void }
  }
  Image: new () => { onload: () => void; onerror: () => void; src: string; naturalWidth: number }
  sessionDesktop: {
    allowPreview(file: unknown): Promise<string | null>
    revokePreview(url: string): Promise<void>
  }
}

/**
 * A picked file's staged thumbnail, end to end: the preload grants the `File`, main opens the path
 * behind the grant, and an `<img>` draws it. A folder name outside ASCII, since that path crosses
 * the preload, main and the bridge. A path the page names itself, and a grant taken back, are
 * refused.
 */
test('draws a picked file by its staged thumbnail, and nothing that was not picked @desktop @medium-risk', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-staged-thumbnail-'))
  const folder = join(dataDir, 'été 日本 #1')
  mkdirSync(folder)
  const photo = join(folder, 'unsplash-07.jpg')
  writeFileSync(photo, JPEG)
  writeFileSync(join(folder, 'unsplash-08.jpg'), JPEG)

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

    await page.evaluate(() => {
      const { document } = globalThis as unknown as PageGlobals
      const input = document.createElement('input')
      input.type = 'file'
      input.id = 'staged-thumbnail-probe'
      document.body.append(input)
    })
    await page.setInputFiles('#staged-thumbnail-probe', photo)

    const allow = () =>
      page.evaluate(async () => {
        const { document, sessionDesktop } = globalThis as unknown as PageGlobals
        const file = document.getElementById('staged-thumbnail-probe')?.files?.[0]
        return file === undefined ? null : sessionDesktop.allowPreview(file)
      })
    const url = await allow()
    expect(url).toMatch(/^session-media:\/\/picked\/[0-9a-f]{32}$/)

    const draw = (src: string) =>
      page.evaluate(
        (at) =>
          new Promise<number>((resolve) => {
            const { Image } = globalThis as unknown as PageGlobals
            const image = new Image()
            image.onload = () => {
              resolve(image.naturalWidth)
            }
            image.onerror = () => {
              resolve(0)
            }
            image.src = at
          }),
        src,
      )
    expect(await draw(url ?? '')).toBeGreaterThan(0)

    // What main answers a url with, asked from main, where no cache of the page's stands between.
    const status = (at: string) =>
      app.evaluate(async ({ net }, target) => (await net.fetch(target)).status, at)

    // A picture beside it, there and decodable, that nobody picked, named by its path: a well
    // formed url, which main refuses for naming a path rather than for its shape.
    const beside = stagedThumbnailUrl(join(folder, 'unsplash-08.jpg'))
    expect(beside).not.toBeNull()
    expect(await status(beside ?? '')).toBe(403)
    expect(await draw(beside ?? '')).toBe(0)

    // Picked again, a file is a new url; one drawn and then taken back is refused from then on.
    const again = await allow()
    expect(again).not.toBe(url)
    expect(await draw(again ?? '')).toBeGreaterThan(0)
    expect(await status(again ?? '')).toBe(200)
    await page.evaluate((at) => {
      const { sessionDesktop } = globalThis as unknown as PageGlobals
      return sessionDesktop.revokePreview(at)
    }, again ?? '')
    expect(await status(again ?? '')).toBe(403)
  } finally {
    await app.close()
  }
})
