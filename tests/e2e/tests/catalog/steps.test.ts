import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const fixture = fileURLToPath(new URL('fixtures/interruptible.ts', import.meta.url))
const packageDir = fileURLToPath(new URL('../..', import.meta.url))

/** Runs the fixture, signals it alone once its long step has started, and reports how it ended. */
async function interrupt(
  signal: NodeJS.Signals,
): Promise<{ code: number | null; log: string[]; elapsedMs: number }> {
  const log = join(mkdtempSync(join(tmpdir(), 'catalog-steps-')), 'log')
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', fixture, log], {
    cwd: packageDir,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise<void>((resolve) => {
    child.stdout.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('▶ wait')) resolve()
    })
  })
  const started = Date.now()
  child.kill(signal)
  const code = await new Promise<number | null>((resolve) => child.on('exit', resolve))
  const lines = (() => {
    try {
      return readFileSync(log, 'utf8').trim().split('\n')
    } catch {
      return []
    }
  })()
  return { code, log: lines, elapsedMs: Date.now() - started }
}

describe('an interrupt during a step', () => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    it(`stops the command on ${signal}: the step's child, no later step, cleanup run`, async () => {
      const ended = await interrupt(signal)
      expect(ended.code).toBe(2)
      expect(ended.log).toEqual(['cleaned up'])
      // The step's child sleeps for 30 s unless the signal is passed on to it.
      expect(ended.elapsedMs).toBeLessThan(10_000)
    })
})
