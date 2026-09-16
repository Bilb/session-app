/**
 * How much of libsession's own logging to forward, per category.
 *
 * A single level is a firehose: `quic` and `session-router` alone produce thousands of lines a
 * second at debug, which buries the handful that answer a question and, once there is a log buffer
 * to export, fills it with seconds of the wrong history.
 */
/** Structurally identical to `@session/bridge-types`' own, which this package may not import. */
export type LibsessionLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'

/** One category turned up or down, on top of the default. */
export interface LogCategoryLevel {
  category: string
  level: LibsessionLogLevel
}

export interface LogSpec {
  /** Applied to every category first, so the pairs below are overrides rather than the whole set. */
  level?: LibsessionLogLevel
  categories: LogCategoryLevel[]
}

const LEVELS: readonly string[] = ['trace', 'debug', 'info', 'warn', 'error', 'critical']

function level(value: string): LibsessionLogLevel | undefined {
  return LEVELS.includes(value) ? (value as LibsessionLogLevel) : undefined
}

/**
 * Reads `warn,network=debug,client=debug` into a default and its overrides.
 *
 * A bare level anywhere sets the default; `category=level` pairs override it. Order in the string
 * does not matter, because the default is applied to every category before the overrides are.
 *
 * Anything unreadable is dropped rather than throwing: this comes from a `.env` a person edits,
 * and refusing to start over a typo in a diagnostic setting is worse than starting without it.
 * A category no dependency declares is passed through unchanged - libsession makes a logger for
 * it that matches no line, which costs nothing, and no list here could be authoritative anyway.
 */
export function parseLogSpec(value: string | undefined): LogSpec | undefined {
  const parts = (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return undefined

  const spec: LogSpec = { categories: [] }

  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) {
      const bare = level(part)
      if (bare !== undefined) spec.level = bare
      continue
    }

    const name = part.slice(0, eq).trim()
    const wanted = level(part.slice(eq + 1).trim())
    if (name.length === 0 || wanted === undefined) continue
    spec.categories.push({ category: name, level: wanted })
  }

  return spec.level === undefined && spec.categories.length === 0 ? undefined : spec
}
