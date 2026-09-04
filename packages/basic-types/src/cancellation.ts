// ==============================
// Core Types
// ==============================

export interface CancellationToken {
  readonly cancelled: boolean
  readonly reason?: Error | undefined
  onCancel(cb: (reason?: Error) => void): () => void
}

// ==============================
// Scheduler (required for time)
// ==============================

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

export type WithScheduler = { scheduler: Scheduler }

// ==============================
// Source (like AbortController)
// ==============================

export class CancellationTokenSource {
  private _cancelled = false
  private _reason: Error | undefined
  private readonly listeners = new Set<(reason?: Error) => void>()

  // Arrow closures capture `this` without aliasing; object getters delegate to them.
  readonly token: CancellationToken = (() => {
    const isCancelled = () => this._cancelled
    const getReason = () => this._reason
    return {
      get cancelled() {
        return isCancelled()
      },
      get reason() {
        return getReason()
      },
      onCancel: (cb: (reason?: Error) => void) => {
        if (this._cancelled) {
          cb(this._reason)
          return () => {}
        }
        this.listeners.add(cb)
        return () => this.listeners.delete(cb)
      },
    }
  })()

  cancel(reason?: Error) {
    if (this._cancelled) return
    this._cancelled = true
    this._reason = reason

    for (const l of this.listeners) l(reason)
    this.listeners.clear()
  }
}

function toAbortSignalLike(token: CancellationToken): AbortSignalLike {
  const listeners = new Set<() => void>()
  token.onCancel(() => {
    for (const l of listeners) l()
    listeners.clear()
  })
  return {
    get aborted() {
      return token.cancelled
    },
    addEventListener(_: 'abort', l: () => void) {
      if (token.cancelled) {
        l()
        return
      }
      listeners.add(l)
    },
    removeEventListener(_: 'abort', l: () => void) {
      listeners.delete(l)
    },
  }
}

export const Cancellation = {
  throwIfCancelled,
  timeout,
  race,
  all,
  fromAbortSignal,
  toAbortSignalLike,
  withCancellation,
}

// ==============================
// Helpers
// ==============================

function throwIfCancelled(token?: CancellationToken): void {
  if (token?.cancelled) {
    throw token.reason ?? new Error('Cancelled')
  }
}

// ==============================
// Timeout (scheduler-based)
// ==============================

function timeout(scheduler: Scheduler, ms: number): CancellationToken {
  const src = new CancellationTokenSource()

  const id = scheduler.setTimeout(() => {
    src.cancel(new Error('Timeout'))
  }, ms)

  src.token.onCancel(() => {
    scheduler.clearTimeout(id)
  })

  return src.token
}

// ==============================
// Composition
// ==============================

function race(...inputs: (CancellationToken | undefined)[]): CancellationToken {
  const src = new CancellationTokenSource()

  for (const t of inputs) {
    if (!t) continue

    if (t.cancelled) {
      src.cancel(t.reason)
      return src.token
    }

    const unsub = t.onCancel((reason) => {
      src.cancel(reason)
      unsub()
    })
  }

  return src.token
}

function all(...inputs: (CancellationToken | undefined)[]): CancellationToken {
  const tokens = inputs.filter(Boolean) as CancellationToken[]
  const src = new CancellationTokenSource()

  if (tokens.length === 0) return src.token

  let remaining = tokens.length

  for (const t of tokens) {
    if (t.cancelled) {
      remaining--
      continue
    }

    const unsub = t.onCancel(() => {
      remaining--
      unsub()

      if (remaining === 0) {
        src.cancel()
      }
    })
  }

  if (remaining === 0) {
    src.cancel()
  }

  return src.token
}

// ==============================
// AbortSignal Adapter (boundary)
// ==============================

export interface AbortSignalLike {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void): void
  removeEventListener(type: 'abort', listener: () => void): void
}

function fromAbortSignal(signal: AbortSignalLike): CancellationToken {
  return {
    get cancelled() {
      return signal.aborted
    },
    onCancel(cb) {
      if (signal.aborted) {
        cb()
        return () => {}
      }

      const handler = () => cb()
      signal.addEventListener('abort', handler)

      return () => signal.removeEventListener('abort', handler)
    },
  }
}

// ==============================
// Utility: wrap async with cancellation
// ==============================

function withCancellation<T>(
  token: CancellationToken | undefined,
  fn: (token: CancellationToken) => Promise<T>,
): Promise<T> {
  const t = token ?? new CancellationTokenSource().token

  if (t.cancelled) {
    return Promise.reject(t.reason ?? new Error('Cancelled'))
  }

  return new Promise<T>((resolve, reject) => {
    let finished = false

    const unsubscribe = t.onCancel((reason) => {
      done(() => reject(reason ?? new Error('Cancelled')))
    })

    const done = (fn: () => void) => {
      if (finished) return
      finished = true
      unsubscribe()
      fn()
    }

    fn(t).then(
      (value) => done(() => resolve(value)),
      // Forwards the inner rejection unchanged: wrapping a non-Error here would hide
      // whatever the caller's own function rejected with.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      (err: unknown) => done(() => reject(err)),
    )
  })
}
