import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { arch, release } from 'node:os'
import { join } from 'node:path'

import electron from 'electron'

import {
  createLogger,
  networkRows,
  startupBlock,
  LogWriter,
  Pseudonyms,
  type LogDirectory,
  type Logger,
} from '@session/logging'

import { networkSettings } from './bridge'
import { linuxRows, osText } from './platformRows'
import { isFromAppFrame } from './security'

const { app } = electron

/**
 * When this process started, which names the launch's file. `process.uptime` rather than the
 * moment this module loads, so the name and the uptime column agree about where zero is.
 */
const launchMs = Date.now() - process.uptime() * 1000

/** Lines in one `appendLog` call; the renderer batches, and a batch past this is a bug. */
const MAX_LINES_PER_CALL = 2000
/** One line's length; a line past it is cut, with a note, rather than refused. */
const MAX_LINE_LENGTH = 16_384
const SALT_BYTES = 16
const SALT_FILE = '.salt'

/**
 * The log directory through `fs`, **synchronously on purpose**.
 *
 * A flush is a few kilobytes every two seconds, so blocking main for it costs nothing, and the
 * last flush is the one that matters most: it happens on the way out, where an asynchronous
 * write can be cut off by the process ending before it lands.
 */
function fsDirectory(dir: string): LogDirectory {
  return {
    list: () =>
      Promise.resolve(
        readdirSync(dir).map((name) => ({ name, sizeBytes: statSync(join(dir, name)).size })),
      ),
    append: (name, text) => {
      appendFileSync(join(dir, name), text, 'utf8')
      return Promise.resolve()
    },
    remove: (name) => {
      rmSync(join(dir, name), { force: true })
      return Promise.resolve()
    },
    read: (name) => Promise.resolve(readFileSync(join(dir, name), 'utf8')),
  }
}

/**
 * The pseudonym key, made on first use and kept beside the logs.
 *
 * Beside them rather than in the keychain because the logs must never depend on the database or
 * its key, and never inside them: an export carries the files and not this, so nobody holding one
 * can hash a guessed id to find it.
 */
function readSalt(dir: string): Uint8Array {
  const path = join(dir, SALT_FILE)
  try {
    const hex = readFileSync(path, 'utf8').trim()
    if (/^[0-9a-f]{32,}$/.test(hex)) return Uint8Array.from(Buffer.from(hex, 'hex'))
  } catch {
    // Not there yet: made below.
  }
  const salt = randomBytes(SALT_BYTES)
  writeFileSync(path, salt.toString('hex'), { mode: 0o600 })
  return Uint8Array.from(salt)
}

export interface MainLogs {
  logger: Logger
  writer: LogWriter
  salt: Uint8Array
}

let opened: Promise<MainLogs> | null = null

/** `/etc/os-release`, or null where there is none, which is everywhere but Linux. */
function readOsRelease(): string | null {
  try {
    return readFileSync('/etc/os-release', 'utf8')
  } catch {
    return null
  }
}

/** A flag's variable, named as the renderer names the flag: `disableAnimations=1`. */
function flagOverrides(flags: Record<string, string>): string[] {
  return Object.entries(flags).map(([variable, value]) => {
    const words = variable.replace('EXPO_PUBLIC_SESSION_FLAG_', '').toLowerCase().split('_')
    const name = words.map((word, i) =>
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    return `${name.join('')}=${value}`
  })
}

/**
 * The startup block, written by main rather than the renderer: main starts first, so the block
 * opens the file, and it is written even when the renderer never loads - which is when a log is
 * wanted most.
 */
function mainStartupBlock(writer: LogWriter): string[] {
  const build = __SESSION_BUILD_INFO__
  const network = networkRows(networkSettings())
  return startupBlock({
    launchedAtMs: launchMs,
    version: build.version,
    buildNumber: null,
    commit: build.commit,
    libsessionCommit: build.libsessionCommit,
    variant: build.variant || 'unknown',
    install: 'unknown',
    model: arch(),
    os: osText(process.platform, process.getSystemVersion(), release()),
    platformRows: linuxRows({
      platform: process.platform,
      env: process.env,
      osRelease: readOsRelease(),
    }),
    locale: app.getLocale(),
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
    network: network.network,
    transport: network.transport,
    networkSettings: network.networkSettings,
    flagOverrides: flagOverrides(build.flags),
    logSpec: network.logSpec,
    previousRun: writer.previousRun,
  })
}

/** What the renderer needs to write lines main will accept, and the facts only main can read. */
interface LogSession {
  saltHex: string
  /** Main's uptime as the renderer asked, so both processes write one clock. */
  uptimeMs: number
}

/**
 * The logs, opened once per process: `userData/logs`, a new file for this launch.
 *
 * Main writes its own lines straight to the writer, and the renderer's arrive through
 * `serveLogs`. If the directory cannot be made the logger writes to the console alone and says
 * why there, which is all that is left to say it to.
 */
export function openLogs(): Promise<MainLogs> {
  opened ??= (async (): Promise<MainLogs> => {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    const salt = readSalt(dir)
    const writer = await LogWriter.open(fsDirectory(dir), {
      launchMs,
      onError: (error) => {
        console.error('[logs] a write failed:', error)
      },
    })
    const logger = createLogger({
      sink: writer,
      pseudonyms: new Pseudonyms(salt),
      now: () => Date.now(),
      uptimeMs: () => process.uptime() * 1000,
      ...(app.isPackaged
        ? {}
        : {
            echo: (_level, line) => {
              console.log(line)
            },
          }),
    })
    // After ready, which is when Electron can say the locale; nothing logs before then.
    await app.whenReady()
    logger.section(mainStartupBlock(writer))
    logger.marker('lifecycle', 'launch', { process: 'main' })
    return { logger, writer, salt }
  })()
  return opened
}

/**
 * The renderer's two log calls, on this window's own `ipc`.
 *
 * `log:open` hands over the pseudonym salt and main's clock; the renderer is the less trusted
 * of the two processes, but a salt only lets its holder recompute pseudonyms of ids it already
 * has, and the renderer has them all anyway. `log:append` takes finished lines: bounded in count
 * and length, and with any newline escaped so one call cannot forge a line of another.
 */
export function serveLogs(window: Electron.BrowserWindow, appUrl: string): void {
  const { ipc } = window.webContents

  ipc.handle('log:open', async (event): Promise<LogSession> => {
    if (!isFromAppFrame(event.senderFrame, appUrl)) throw new Error('refused')
    const { salt } = await openLogs()
    return { saltHex: Buffer.from(salt).toString('hex'), uptimeMs: process.uptime() * 1000 }
  })

  ipc.on('log:append', (event, lines: unknown, urgent: unknown) => {
    if (!isFromAppFrame(event.senderFrame, appUrl)) return
    if (!Array.isArray(lines) || lines.length > MAX_LINES_PER_CALL) return
    const accepted = lines
      .filter((line): line is string => typeof line === 'string')
      .map((line) =>
        (line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH)} [cut]` : line).replace(
          /\r?\n/g,
          '\\n',
        ),
      )
    void openLogs().then(({ writer }) => {
      writer.write(accepted, urgent === true)
    })
  })
}
