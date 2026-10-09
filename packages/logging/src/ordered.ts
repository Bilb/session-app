import type { LogSink } from './logger'
import type { TimerHost } from './writer'

interface Held {
  wallMs: number
  /** Arrival order, to break a tie: two lines logged in one millisecond stay in turn. */
  seq: number
  lines: readonly string[]
}

export interface OrderedSinkOptions {
  /**
   * How long a line waits for one logged earlier to arrive. Longer than the slowest source's own
   * batching, or that source's lines are still written late.
   */
  holdMs: number
  now?: () => number
  timers?: TimerHost
}

/**
 * A sink in front of another that writes lines in the order they were logged, not the order they
 * arrived: the desktop main process writes its own lines and the renderer's, and the renderer's
 * come in batches.
 *
 * Each line is held for `holdMs` and then released with everything logged before it. An urgent
 * line releases everything at once, since what it is urgent about is reaching the disk; a line
 * from the slow source that arrives after that is written after it, which only ever affects the
 * moment around a marker or an error.
 */
export function orderedSink(inner: LogSink, options: OrderedSinkOptions): LogSink {
  const { holdMs } = options
  const now = options.now ?? ((): number => Date.now())
  let held: Held[] = []
  let seq = 0
  const timers = options.timers ?? (globalThis as unknown as TimerHost)
  let timer: unknown = null

  function release(upToMs: number, urgent: boolean): void {
    held.sort((a, b) => a.wallMs - b.wallMs || a.seq - b.seq)
    const due = held.filter((entry) => entry.wallMs <= upToMs)
    held = held.filter((entry) => entry.wallMs > upToMs)
    const last = due.at(-1)
    if (last !== undefined) {
      inner.write(
        due.flatMap((entry) => entry.lines),
        urgent,
        last.wallMs,
      )
    }
  }

  function schedule(): void {
    if (timer !== null || held.length === 0) return
    timer = timers.setTimeout(() => {
      timer = null
      release(now() - holdMs, false)
      schedule()
    }, holdMs)
  }

  return {
    write(lines, urgent, wallMs) {
      seq += 1
      held.push({ wallMs, seq, lines })
      if (urgent) {
        if (timer !== null) timers.clearTimeout(timer)
        timer = null
        release(Number.POSITIVE_INFINITY, true)
      } else {
        schedule()
      }
    },
  }
}
