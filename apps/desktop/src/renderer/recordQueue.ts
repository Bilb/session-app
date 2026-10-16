import type { LogRecord } from '@session/logging'

/** The renderer's records on their way to main, which sweeps, renders and writes them. */
export interface RecordQueue {
  /** The forwarding logger's `send`. */
  send: (record: LogRecord, urgent: boolean) => void
  /** Hands over whatever is waiting, now. */
  flush: () => void
}

/**
 * Records handed to `append` once per task: a burst logged in one go is one IPC message, and no
 * record waits past the end of the task that logged it, so there is nothing left here for a
 * closing window or a restart to lose. An urgent record goes at once with whatever came before it.
 */
export function recordQueue(
  append: (records: LogRecord[]) => void,
  defer: (run: () => void) => void = queueMicrotask,
): RecordQueue {
  let pending: LogRecord[] = []
  let scheduled = false
  const flush = (): void => {
    scheduled = false
    const records = pending
    pending = []
    if (records.length > 0) append(records)
  }
  return {
    send: (record, urgent) => {
      pending.push(record)
      if (urgent) {
        flush()
      } else if (!scheduled) {
        scheduled = true
        defer(flush)
      }
    },
    flush,
  }
}
