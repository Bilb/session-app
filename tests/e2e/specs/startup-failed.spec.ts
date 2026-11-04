import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { _electron, expect, test } from '@playwright/test'
import { PENDING_COPY, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import { FAKE_LAUNCH_ENV } from '../harness/fakeEnv'

const repoRoot = join(import.meta.dirname, '../../..')

/** How the screen draws a catalogue string: its line breaks as breaks, not markup. */
function drawn(text: string): string {
  return text.replaceAll('<br/>', '\n')
}

/**
 * The app on the fake, keeping a database key in `dataDir` as the real bridge does. The keychain is
 * Chromium's stand-in, so nothing here reaches the real one.
 */
function launchWithKeyCustody(dataDir: string) {
  return _electron.launch({
    args: [
      join(repoRoot, 'apps/desktop/out/main/index.js'),
      `--user-data-dir=${dataDir}`,
      '--password-store=basic',
      '--use-mock-keychain',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    env: {
      ...process.env,
      ...FAKE_LAUNCH_ENV,
      EXPO_PUBLIC_SESSION_FAKE_KEY_CUSTODY: '1',
      // What the bridge opens once a clear has replaced the database: a device with no account.
      EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'newcomer',
      // The data directory is per network, and a developer's .env must not move it.
      EXPO_PUBLIC_SESSION_NETID: '',
      SESSION_DATA_DIR: dataDir,
    },
  })
}

/**
 * A start that fails lands on its own screen rather than leaving the launch screen up, and that
 * screen hands over libsession's message and the logs, asks before clearing anything, and recovers
 * in place.
 */
test('a failed start shows why, exports logs, asks before clearing, and recovers in place @desktop', async () => {
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
      ...FAKE_LAUNCH_ENV,
      EXPO_PUBLIC_SESSION_FAKE_FAILED_START: '1',
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
    await expect(page.getByTestId(ELEMENT.toast.item).first()).toHaveText(tr('copied'))
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
    expect(text).toMatch(/pressed export logs kind=unreadable/)

    // A database the key does not open: restarting will not help, so it is not suggested.
    await expect(page.getByTestId(ELEMENT.startupFailed.explanation).first()).toHaveText(
      drawn(tr('databaseErrorGeneric')),
    )

    // Clearing asks first, saying what goes and what brings the account back, with a Cancel that
    // leaves everything where it was.
    await page.getByTestId(ELEMENT.startupFailed.clear).first().click()
    await expect(page.getByTestId(ELEMENT.startupFailed.confirmClear).first()).toContainText(
      drawn(PENDING_COPY.databaseErrorClearDeviceWarning),
    )
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

/**
 * A bridge that could not be made at all: nothing was opened, so the screen does not call it a
 * database error, offers nothing to clear, and shows the reason as the bridge gave it.
 */
test('a bridge that could not be made says why, without blaming the database @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-no-bridge-'))
  // The fake refuses to make its bridge without its dev photographs.
  const noPhotos = join(dataDir, 'no-photos')
  mkdirSync(noPhotos)
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
      SESSION_FAKE_MEDIA_DIR: noPhotos,
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('An unknown error occurred.').first()).toBeVisible()
    await expect(page.getByText(/database error/)).toHaveCount(0)
    await expect(page.getByTestId(ELEMENT.startupFailed.reason).first()).toHaveText(
      /^the bridge could not start: The fake needs its dev photographs in .* Run: pnpm fake-media:fetch$/,
    )
    await expect(page.getByTestId(ELEMENT.startupFailed.clear)).toHaveCount(0)
    await expect(page.getByTestId(ELEMENT.startupFailed.quit).first()).toBeVisible()
  } finally {
    await app.close()
  }
})

/**
 * A key that is gone while its database is still there: the key is not made again, which would
 * lose the account for good. The screen calls it unreadable, and its Clear works without a bridge:
 * the database goes, a new key is made, and the app starts again in place, on onboarding.
 */
test('a key gone from beside its database is not remade, and Clear starts again without it @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-key-missing-'))
  const networkDir = join(dataDir, 'mainnet')
  mkdirSync(networkDir)
  writeFileSync(join(networkDir, 'session.db'), 'pages a lost key opened')
  const app = await launchWithKeyCustody(dataDir)
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId(ELEMENT.startupFailed.reason).first()).toHaveText(
      'the database key is missing, but a database exists',
    )
    await expect(page.getByTestId(ELEMENT.startupFailed.explanation).first()).toHaveText(
      drawn(tr('databaseErrorGeneric')),
    )
    expect(existsSync(join(networkDir, 'db-key.bin'))).toBe(false)
    expect(existsSync(join(networkDir, 'session.db'))).toBe(true)

    await page.getByTestId(ELEMENT.startupFailed.clear).first().click()
    await page.getByTestId(ELEMENT.startupFailed.confirmClearButton).first().click()
    await expect(page.getByTestId(ELEMENT.onboarding.createAccount).first()).toBeVisible()
    expect(existsSync(join(networkDir, 'session.db'))).toBe(false)
    expect(existsSync(join(networkDir, 'db-key.bin'))).toBe(true)
  } finally {
    await app.close()
  }
})

/**
 * A key that is there but cannot be read now: the file is left alone, the screen says a restart
 * may help, and its Quit ends the process -- on macOS too, where closing the window does not.
 */
test('a key that cannot be read now is left alone, and Quit ends the app @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-key-unavailable-'))
  const networkDir = join(dataDir, 'mainnet')
  // A directory where the file belongs: as unreadable as a file the keychain will not unseal.
  mkdirSync(join(networkDir, 'db-key.bin'), { recursive: true })
  const app = await launchWithKeyCustody(dataDir)
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId(ELEMENT.startupFailed.reason).first()).toHaveText(
      /^the database key could not be read: db-key\.bin could not be read \(EISDIR\)$/,
    )
    await expect(page.getByTestId(ELEMENT.startupFailed.explanation).first()).toHaveText(
      tr('shareExtensionDatabaseError'),
    )
    await expect(page.getByTestId(ELEMENT.startupFailed.clear).first()).toBeVisible()

    const exited = new Promise<void>((resolve) => {
      app.process().once('exit', () => {
        resolve()
      })
    })
    await page.getByTestId(ELEMENT.startupFailed.quit).first().click()
    await exited
    expect(existsSync(join(networkDir, 'db-key.bin'))).toBe(true)

    // The press was written before the process went.
    const logs = join(dataDir, 'logs')
    const written = readdirSync(logs)
      .map((name) => readFileSync(join(logs, name), 'utf8'))
      .join('')
    expect(written).toMatch(/pressed quit kind=transient/)
  } finally {
    await app.close()
  }
})

/**
 * A database another process holds: the bridge was made, so on macOS closing the window would
 * leave it running. Quit ends the process all the same, which is what makes "restart" true.
 */
test('a locked database says a restart may help, and Quit ends the app with a bridge open @desktop', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'session-locked-'))
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
      EXPO_PUBLIC_SESSION_FAKE_FAILED_START: 'locked',
      SESSION_DATA_DIR: dataDir,
    },
  })
  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId(ELEMENT.startupFailed.screen).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId(ELEMENT.startupFailed.reason).first()).toHaveText(
      'setAttachmentCacheLimit: the bridge has no database open: database is locked',
    )
    await expect(page.getByTestId(ELEMENT.startupFailed.explanation).first()).toHaveText(
      tr('shareExtensionDatabaseError'),
    )

    const exited = new Promise<void>((resolve) => {
      app.process().once('exit', () => {
        resolve()
      })
    })
    await page.getByTestId(ELEMENT.startupFailed.quit).first().click()
    await exited
  } finally {
    await app.close()
  }
})
