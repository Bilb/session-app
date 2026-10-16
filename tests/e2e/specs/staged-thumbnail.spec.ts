import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron, expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/** Enough of a JPEG for the bridge's sniff: the fake answers with that photograph's thumbnail. */
const JPEG_HEAD = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46)

/** What the page code below reaches, since the specs compile without the DOM library. */
interface PageGlobals {
  document: {
    createElement(tag: 'input'): { type: string; id: string }
    getElementById(id: string): { files: readonly unknown[] | null } | null
    body: { append(node: unknown): void }
  }
  Image: new () => { onload: () => void; onerror: () => void; src: string; naturalWidth: number }
  sessionDesktop: { allowPreview(file: unknown): Promise<string | null> }
}

/**
 * A picked file's staged thumbnail, end to end: the preload grants the `File`, main serves the url
 * Chromium canonicalised, and an `<img>` draws it. A folder name outside ASCII, since that is what
 * Chromium's escaping and both parsers have to agree on; a path nobody granted is refused.
 *
 * Through the page's own file input rather than the composer, so it holds whatever the
 * `attachmentSending` flag the build was made with.
 */
test('draws a picked file by its staged thumbnail, and nothing that was not picked', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-staged-thumbnail-'))
  const folder = join(dataDir, 'été 日本 #1')
  mkdirSync(folder)
  const photo = join(folder, 'unsplash-07.jpg')
  writeFileSync(photo, JPEG_HEAD)
  writeFileSync(join(folder, 'unsplash-08.jpg'), JPEG_HEAD)

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

    const url = await page.evaluate(async () => {
      const { document, sessionDesktop } = globalThis as unknown as PageGlobals
      const file = document.getElementById('staged-thumbnail-probe')?.files?.[0]
      return file === undefined ? null : sessionDesktop.allowPreview(file)
    })
    expect(url).toMatch(/^session-media:\/\/staged\/%2F.*unsplash-07\.jpg$/)

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
    // A picture beside it, there and decodable, that nobody picked.
    expect(await draw((url ?? '').replace('unsplash-07', 'unsplash-08'))).toBe(0)
  } finally {
    await app.close()
  }
})
