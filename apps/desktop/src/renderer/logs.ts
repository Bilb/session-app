import { appLog, logStoreMilestones, startLogger } from '@session/app'
import { createForwardingLogger, type LogLevel, type LogRecord } from '@session/logging'
import type { SessionStore } from '@session/state'

/**
 * How long the renderer holds records before handing them to main, unless one is urgent. Main
 * holds its own lines a little longer than this (`RENDERER_HOLD_MS` in main's logs.ts) so that
 * the two come out in order.
 */
const BATCH_MS = 500

/**
 * Records on their way to main, which sweeps, renders and writes them.
 *
 * Batched because each send is an IPC message. An urgent record goes at once with whatever is
 * waiting.
 */
function sendToMain(): (record: LogRecord, urgent: boolean) => void {
  let pending: LogRecord[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  const send = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    const records = pending
    pending = []
    if (records.length > 0) window.sessionDesktop.appendLog(records)
  }
  // A closing window takes whatever is waiting with it otherwise.
  window.addEventListener('pagehide', send)
  return (record, urgent) => {
    pending.push(record)
    if (urgent) send()
    else timer ??= setTimeout(send, BATCH_MS)
  }
}

/**
 * The renderer's logger: lines go to main as they are logged, and main sweeps, renders and writes
 * them, so the thread that draws the app does none of that work. The store's lines go to it, and
 * to the console too outside a packaged build.
 */
export async function startLogging(store: SessionStore): Promise<void> {
  const session = await window.sessionDesktop.openLog()
  // Main's uptime when it answered, so both processes' lines share one zero.
  const offsetMs = session.uptimeMs - performance.now()
  const logger = createForwardingLogger({
    send: sendToMain(),
    uptimeMs: () => performance.now() + offsetMs,
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
