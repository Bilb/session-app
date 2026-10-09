import { appLog, logStoreMilestones, startLogger } from '@session/app'
import { createLogger, Pseudonyms, type LogLevel, type LogSink } from '@session/logging'
import type { SessionStore } from '@session/state'

/** How long the renderer holds lines before handing them to main, unless one is urgent. */
const BATCH_MS = 500

/**
 * Lines on their way to main, which owns the files.
 *
 * Batched because each send is an IPC message; main buffers again before it writes, so this only
 * has to keep the message count down. An urgent line goes at once with whatever is waiting.
 */
function mainSink(): LogSink {
  let pending: string[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  const send = (urgent: boolean): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    const lines = pending
    pending = []
    if (lines.length > 0) window.sessionDesktop.appendLog(lines, urgent)
  }
  // A closing window takes whatever is waiting with it otherwise.
  window.addEventListener('pagehide', () => {
    send(true)
  })
  return {
    write: (lines, urgent) => {
      pending.push(...lines)
      if (urgent) send(true)
      else
        timer ??= setTimeout(() => {
          send(false)
        }, BATCH_MS)
    },
  }
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
}

/**
 * The renderer's logger: lines rendered here, with main's salt and main's clock, and written by
 * main. The store's lines go to it, and to the console too outside a packaged build.
 */
export async function startLogging(store: SessionStore): Promise<void> {
  const session = await window.sessionDesktop.openLog()
  // Main's uptime when it answered, so both processes' lines share one zero.
  const offsetMs = session.uptimeMs - performance.now()
  const logger = createLogger({
    sink: mainSink(),
    pseudonyms: new Pseudonyms(hexToBytes(session.saltHex)),
    uptimeMs: () => performance.now() + offsetMs,
    minLevel: (category) => (category === 'session' ? 'debug' : 'info'),
  })
  // Main wrote the startup block when it started; this process only marks its own launch.
  startLogger(logger, null, { process: 'renderer' })
  logStoreMilestones(store)
}

/** The store's `log` option: every line to the file, and to the console in development. */
export function storeLog(level: LogLevel, category: string, message: string, op?: string): void {
  appLog.log(level, category, message, undefined, op)
  if (import.meta.env.DEV) {
    const method = level === 'critical' ? 'error' : level === 'trace' ? 'debug' : level
    console[method](`[${category}] ${message}`)
  }
}
