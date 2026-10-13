import { logStoreMilestones, startLogger, storeLogger } from '@session/app'
import { createForwardingLogger } from '@session/logging'
import type { SessionStore } from '@session/state'

import { recordQueue } from './recordQueue'

/**
 * Records on their way to main, sent at the end of the task that logged them. Main holds its own
 * lines a moment (`RENDERER_HOLD_MS` in main's logs.ts) so that the two come out in order.
 */
const toMain = recordQueue((records) => {
  window.sessionDesktop.appendLog(records)
})

/**
 * Hands main every record logged so far, ahead of a message that ends the process: both travel on
 * this frame's one channel, so main takes the records first.
 */
export function flushLogRecords(): void {
  toMain.flush()
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
    send: toMain.send,
    uptimeMs: () => performance.now() + offsetMs,
  })
  // Main wrote the startup block when it started; this process only marks its own launch.
  startLogger(logger, null, { process: 'renderer' })
  logStoreMilestones(store)
}

/**
 * The store's `log` option: every line to the file, and under the dev server to DevTools as well,
 * beside the renderer's own errors. Main echoes the lines it writes to its terminal.
 */
export const storeLog = storeLogger(import.meta.env.DEV)
