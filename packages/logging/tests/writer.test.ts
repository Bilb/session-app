import { describe, expect, it } from 'vitest'

import {
  consoleDirectory,
  LogWriter,
  basicUtc,
  logFileName,
  readPreviousRun,
  sortLogFiles,
} from '#src/writer'

import { memoryDirectory } from './helpers'

const LAUNCH = Date.UTC(2026, 9, 8, 3, 20, 9, 500)
const noTimers = { setTimeout: () => 1, clearTimeout: () => undefined }

describe('names', () => {
  it('has no spaces or colons', () => {
    expect(basicUtc(LAUNCH)).toBe('20261008T032009Z')
    expect(logFileName(LAUNCH, 0)).toBe('session-20261008T032009Z-0.log')
  })

  it('sorts by launch and then numerically by part', () => {
    const names = [
      'session-20261008T032009Z-10.log',
      'session-20261007T000000Z-3.log',
      'session-20261008T032009Z-9.log',
      'notes.txt',
    ]
    expect(sortLogFiles(names.map((name) => ({ name }))).map((f) => f.name)).toEqual([
      'session-20261007T000000Z-3.log',
      'session-20261008T032009Z-9.log',
      'session-20261008T032009Z-10.log',
    ])
  })
})

describe('LogWriter', () => {
  it('starts a new file for the launch and buffers until flushed', async () => {
    const dir = memoryDirectory()
    const writer = await LogWriter.open(dir, { launchMs: LAUNCH, timers: noTimers })
    writer.write(['one', 'two'], false)
    expect(dir.files.size).toBe(0)
    await writer.flush()
    expect(dir.files.get('session-20261008T032009Z-0.log')).toBe('one\ntwo\n')
  })

  it('writes urgent lines without waiting for the timer', async () => {
    const dir = memoryDirectory()
    const writer = await LogWriter.open(dir, { launchMs: LAUNCH, timers: noTimers })
    writer.write(['now'], true)
    await writer.flush()
    expect(dir.files.get(writer.currentFile)).toBe('now\n')
  })

  it('rotates at the size limit, at a line boundary', async () => {
    const dir = memoryDirectory()
    const writer = await LogWriter.open(dir, {
      launchMs: LAUNCH,
      maxFileBytes: 10,
      timers: noTimers,
    })
    writer.write(['aaaa', 'bbbb', 'cccc'], false)
    await writer.flush()
    expect([...dir.files]).toEqual([
      ['session-20261008T032009Z-0.log', 'aaaa\nbbbb\n'],
      ['session-20261008T032009Z-1.log', 'cccc\n'],
    ])
  })

  it('deletes whole files from the oldest end to stay in budget', async () => {
    const dir = memoryDirectory({
      'session-20261001T000000Z-0.log': 'x'.repeat(10),
      'session-20261002T000000Z-0.log': 'y'.repeat(10),
    })
    const writer = await LogWriter.open(dir, {
      launchMs: LAUNCH,
      budgetBytes: 25,
      timers: noTimers,
    })
    writer.write(['zzzzzzz'], false)
    await writer.flush()
    expect([...dir.files.keys()]).toEqual(['session-20261002T000000Z-0.log', writer.currentFile])
  })

  it('keeps writing when an old file will not delete, and says so', async () => {
    const dir = memoryDirectory({
      'session-20261001T000000Z-0.log': 'x'.repeat(10),
      'session-20261002T000000Z-0.log': 'y'.repeat(10),
    })
    dir.remove = () => Promise.reject(new Error('EBUSY'))
    const errors: unknown[] = []
    const writer = await LogWriter.open(dir, {
      launchMs: LAUNCH,
      budgetBytes: 25,
      timers: noTimers,
      onError: (error) => errors.push(error),
    })
    writer.write(['first'], false)
    await writer.flush()
    writer.write(['second'], false)
    await writer.flush()
    expect(dir.files.get(writer.currentFile)).toBe('first\nsecond\n')
    // Reported once, not before every write.
    expect(errors).toHaveLength(1)
  })

  it('never deletes the file it is writing', async () => {
    const dir = memoryDirectory()
    const writer = await LogWriter.open(dir, { launchMs: LAUNCH, budgetBytes: 4, timers: noTimers })
    writer.write(['longer than the budget'], false)
    await writer.flush()
    expect(dir.files.has(writer.currentFile)).toBe(true)
  })

  it('numbers after a launch in the same second rather than appending to it', async () => {
    const dir = memoryDirectory({ 'session-20261008T032009Z-0.log': 'earlier\n' })
    const writer = await LogWriter.open(dir, { launchMs: LAUNCH, timers: noTimers })
    expect(writer.currentFile).toBe('session-20261008T032009Z-1.log')
  })

  it('reports how the previous run ended', async () => {
    const clean = await LogWriter.open(
      memoryDirectory({
        'session-20261001T000000Z-0.log':
          'x INFO [lifecycle] >>> launch\nx INFO [lifecycle] >>> background\n',
      }),
      { launchMs: LAUNCH, timers: noTimers },
    )
    expect(clean.previousRun).toEqual({
      file: 'session-20261001T000000Z-0.log',
      endedCleanly: true,
      lastMarker: 'background',
    })

    const failed = readPreviousRun(
      'f.log',
      'x >>> launch\nx >>> start failed reason="locked" ms=3\n',
    )
    expect(failed.lastMarker).toBe('start failed')

    const died = readPreviousRun('f.log', 'x >>> launch\nx >>> foreground\nsomething\n')
    expect(died).toEqual({ file: 'f.log', endedCleanly: false, lastMarker: 'foreground' })
    // A desktop restart skips the quit marker, and writes its own.
    const restarted = readPreviousRun('f.log', 'x >>> launch\nx >>> restart\n')
    expect(restarted).toEqual({ file: 'f.log', endedCleanly: true, lastMarker: 'restart' })
  })

  it('keeps writing after a failed append, and reports it', async () => {
    const dir = memoryDirectory()
    const errors: unknown[] = []
    let fail = true
    const flaky = {
      ...dir,
      append: (name: string, text: string) => {
        if (fail) {
          fail = false
          return Promise.reject(new Error('disk full'))
        }
        return dir.append(name, text)
      },
    }
    const writer = await LogWriter.open(flaky, {
      launchMs: LAUNCH,
      timers: noTimers,
      onError: (e) => errors.push(e),
    })
    writer.write(['lost'], true)
    writer.write(['kept'], true)
    await writer.flush()
    expect(errors).toHaveLength(1)
    expect(dir.files.get(writer.currentFile)).toBe('kept\n')
  })
})

describe('consoleDirectory', () => {
  it('prints each write, keeps nothing, and lets a writer run on it', async () => {
    const printed: string[] = []
    const writer = await LogWriter.open(
      consoleDirectory((text) => printed.push(text)),
      {
        launchMs: LAUNCH,
        timers: noTimers,
      },
    )
    writer.write(['one', 'two'], true)
    await writer.flush()
    expect(printed).toEqual(['one\ntwo'])
    expect(writer.files()).toEqual([{ name: writer.currentFile, sizeBytes: 'one\ntwo\n'.length }])
  })
})
