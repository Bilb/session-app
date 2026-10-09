import type { LogSink } from './logger'
import { MARKER } from './logger'

/**
 * The few things a log directory has to do, so the rotation rules are written and tested once
 * rather than per platform. Desktop's main process fills it with `fs`, the phones with
 * expo-file-system; names are bare file names inside the one directory.
 */
export interface LogDirectory {
  list(): Promise<LogFileInfo[]>
  append(name: string, text: string): Promise<void>
  remove(name: string): Promise<void>
  read(name: string): Promise<string>
}

/**
 * Where lines go when the log directory cannot be opened: the console, which is the only place
 * left to say anything. Keeps nothing, so a run in this state exports no files.
 */
export function consoleDirectory(print: (text: string) => void): LogDirectory {
  return {
    list: () => Promise.resolve([]),
    append: (_name, text) => {
      print(text.replace(/\n$/, ''))
      return Promise.resolve()
    },
    remove: () => Promise.resolve(),
    read: () => Promise.resolve(''),
  }
}

export interface LogFileInfo {
  name: string
  sizeBytes: number
}

/** A file closes at this size, and the next one opens. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024
/** The whole directory's budget; the oldest whole file goes when a write would pass it. */
export const BUDGET_BYTES = 20 * 1024 * 1024
/** Lines reach the disk at least this often, so a crash loses seconds rather than a session. */
export const FLUSH_MS = 2000

const NAME = /^session-(\d{8}T\d{6}Z)-(\d+)\.log$/

/** `20261008T032009Z`: UTC, no separators, so a file name never carries a colon or a space. */
export function basicUtc(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
}

export function logFileName(launchMs: number, index: number): string {
  return `session-${basicUtc(launchMs)}-${String(index)}.log`
}

/** Oldest first, by launch then by part: `-10` sorts after `-9`, which a string sort gets wrong. */
export function sortLogFiles<T extends { name: string }>(files: readonly T[]): T[] {
  const key = (name: string): [string, number] => {
    const match = NAME.exec(name)
    return [match?.[1] ?? '', Number(match?.[2] ?? 0)]
  }
  return files
    .filter((file) => NAME.test(file.name))
    .sort((a, b) => {
      const [launchA, partA] = key(a.name)
      const [launchB, partB] = key(b.name)
      return launchA === launchB ? partA - partB : launchA < launchB ? -1 : 1
    })
}

/** Bytes as UTF-8 will store them, without an encoder. */
export function utf8Length(text: string): number {
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/** How the run before this one ended, from the last marker it wrote. */
export interface PreviousRun {
  file: string
  /** True when its last marker was a backgrounding or a termination; false means it died. */
  endedCleanly: boolean
  lastMarker: string | null
}

const CLEAN_ENDINGS = ['background', 'restart', 'quit']

export function readPreviousRun(file: string, text: string): PreviousRun {
  const markers = text
    .slice(-16_384)
    .split('\n')
    .filter((line) => line.includes(` ${MARKER} `))
  const last = markers.at(-1)
  // The name runs to the first key=value pair: `start failed reason=...` is `start failed`.
  const words = last?.split(` ${MARKER} `)[1]?.split(' ') ?? []
  const firstPair = words.findIndex((word) => word.includes('='))
  const nameWords = firstPair === -1 ? words : words.slice(0, firstPair)
  const name = last === undefined ? null : nameWords.join(' ') || null
  return { file, endedCleanly: name !== null && CLEAN_ENDINGS.includes(name), lastMarker: name }
}

/** The timers every runtime has, declared here since this package loads no DOM or node types. */
export interface TimerHost {
  setTimeout(handler: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface LogWriterOptions {
  launchMs: number
  maxFileBytes?: number
  budgetBytes?: number
  flushMs?: number
  timers?: TimerHost
  /** Told when a write fails, which the writer cannot itself log anywhere. */
  onError?: (error: unknown) => void
}

/**
 * The files: one per launch, rotated by size, pruned from the oldest end.
 *
 * Writes are buffered and appended in one call per flush - every two seconds, or at once for an
 * urgent line - because a phone's file API costs a bridge crossing per call. Appends are chained,
 * so two flushes never interleave.
 */
export class LogWriter implements LogSink {
  readonly #dir: LogDirectory
  readonly #launchMs: number
  readonly #maxFileBytes: number
  readonly #budgetBytes: number
  readonly #flushMs: number
  readonly #timers: TimerHost
  readonly #onError: (error: unknown) => void
  #files: LogFileInfo[]
  #index = 0
  #currentBytes = 0
  #pending: string[] = []
  #timer: unknown = null
  #chain: Promise<void> = Promise.resolve()
  readonly previousRun: PreviousRun | null

  private constructor(
    dir: LogDirectory,
    files: LogFileInfo[],
    previousRun: PreviousRun | null,
    options: LogWriterOptions,
  ) {
    this.#dir = dir
    this.#files = files
    this.previousRun = previousRun
    this.#launchMs = options.launchMs
    this.#maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES
    this.#budgetBytes = options.budgetBytes ?? BUDGET_BYTES
    this.#flushMs = options.flushMs ?? FLUSH_MS
    this.#timers = options.timers ?? (globalThis as unknown as TimerHost)
    this.#onError = options.onError ?? ((): void => undefined)
    // Two launches in one second share a timestamp; the second carries on numbering after the
    // first rather than appending to its file.
    const sameLaunch = files.filter((file) =>
      file.name.startsWith(`session-${basicUtc(this.#launchMs)}-`),
    )
    this.#index = sameLaunch.length
  }

  static async open(dir: LogDirectory, options: LogWriterOptions): Promise<LogWriter> {
    const files = sortLogFiles(await dir.list())
    const newest = files.at(-1)
    const previousRun =
      newest === undefined ? null : readPreviousRun(newest.name, await dir.read(newest.name))
    return new LogWriter(dir, files, previousRun, options)
  }

  /** The file this launch is writing now. */
  get currentFile(): string {
    return logFileName(this.#launchMs, this.#index)
  }

  write(lines: readonly string[], urgent: boolean): void {
    this.#pending.push(...lines)
    if (urgent) {
      void this.flush()
    } else if (this.#timer === null) {
      this.#timer = this.#timers.setTimeout(() => {
        this.#timer = null
        void this.flush()
      }, this.#flushMs)
    }
  }

  /** Everything written so far, on disk, when this settles. */
  flush(): Promise<void> {
    if (this.#timer !== null) {
      this.#timers.clearTimeout(this.#timer)
      this.#timer = null
    }
    const lines = this.#pending
    this.#pending = []
    if (lines.length > 0) {
      this.#chain = this.#chain
        .then(() => this.#append(lines))
        .catch((error: unknown) => {
          this.#onError(error)
        })
    }
    return this.#chain
  }

  async #append(lines: string[]): Promise<void> {
    // Line by line into files, so a file closes at a line boundary and never mid-record.
    let chunk = ''
    let chunkBytes = 0
    for (const line of lines) {
      const text = `${line}\n`
      const bytes = utf8Length(text)
      if (
        this.#currentBytes + chunkBytes + bytes > this.#maxFileBytes &&
        this.#currentBytes + chunkBytes > 0
      ) {
        await this.#commit(chunk, chunkBytes)
        chunk = ''
        chunkBytes = 0
        this.#index += 1
        this.#currentBytes = 0
      }
      chunk += text
      chunkBytes += bytes
    }
    if (chunk !== '') await this.#commit(chunk, chunkBytes)
  }

  async #commit(text: string, bytes: number): Promise<void> {
    const name = this.currentFile
    await this.#prune(bytes)
    await this.#dir.append(name, text)
    this.#currentBytes += bytes
    const existing = this.#files.find((file) => file.name === name)
    if (existing === undefined) this.#files.push({ name, sizeBytes: bytes })
    else existing.sizeBytes += bytes
  }

  /**
   * Deletes whole files, oldest first, until `incoming` more bytes fit in the budget.
   *
   * A file that will not delete - held open on Windows, a delete the platform refuses - is reported
   * and then no longer counted, rather than tried again before every write: retried, it threw
   * before every append, and nothing more was written for the rest of the run. Over budget is the
   * better failure. The next launch lists the directory afresh and tries it again.
   */
  async #prune(incoming: number): Promise<void> {
    const current = this.currentFile
    let total = this.#files.reduce((sum, file) => sum + file.sizeBytes, 0) + incoming
    while (total > this.#budgetBytes) {
      const oldest = this.#files[0]
      if (oldest === undefined || oldest.name === current) return
      try {
        await this.#dir.remove(oldest.name)
      } catch (error) {
        this.#onError(error)
      }
      this.#files.shift()
      total -= oldest.sizeBytes
    }
  }

  /** The retained files, oldest first, with their sizes as of the last flush. */
  files(): LogFileInfo[] {
    return this.#files.map((file) => ({ ...file }))
  }
}
