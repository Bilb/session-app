import {
  emptyCounts,
  networkRows,
  startupBlock,
  type DeviceFacts,
  type LogFields,
  type Logger,
  type LogLevel,
  type NetworkSettings,
  type StartupFacts,
  type SweepCounts,
} from '@session/logging'

import { flagOverrideRows } from './flags'
import { requirePorts } from './ports'

/**
 * The app's logger, reachable from anywhere without being passed around.
 *
 * Installed by each app's entry once its log directory is open, which takes a moment on every
 * platform - a directory listing, a salt read off disk. Lines logged before then are held and
 * written when it arrives, in order, so the start of a launch is never the part that is missing.
 * The hold is bounded: a logger that never arrives costs memory once, not forever.
 */
let installed: Logger | null = null
const held: ((logger: Logger) => void)[] = []
const HOLD_LIMIT = 1000

function withLogger(write: (logger: Logger) => void): void {
  if (installed !== null) write(installed)
  else if (held.length < HOLD_LIMIT) held.push(write)
}

export function installLogger(logger: Logger): void {
  installed = logger
  for (const write of held.splice(0)) write(logger)
}

/** Test seam: forgets the installed logger and anything held, as a fresh process would. */
export function resetLogger(): void {
  installed = null
  held.length = 0
}

export const appLog = {
  log(level: LogLevel, category: string, message: string, fields?: LogFields, op?: string): void {
    // Timed now, not when the logger takes it: a line held while the directory opened would
    // otherwise carry the moment it opened.
    const wallMs = Date.now()
    withLogger((logger) => {
      logger.at(wallMs).log(level, category, message, fields, op)
    })
  },
  trace(category: string, message: string, fields?: LogFields): void {
    appLog.log('trace', category, message, fields)
  },
  debug(category: string, message: string, fields?: LogFields): void {
    appLog.log('debug', category, message, fields)
  },
  info(category: string, message: string, fields?: LogFields): void {
    appLog.log('info', category, message, fields)
  },
  warn(category: string, message: string, fields?: LogFields): void {
    appLog.log('warn', category, message, fields)
  },
  error(category: string, message: string, fields?: LogFields): void {
    appLog.log('error', category, message, fields)
  },
  critical(category: string, message: string, fields?: LogFields): void {
    appLog.log('critical', category, message, fields)
  },
  /** What the sweep has replaced in this process so far; zeros before there is a logger. */
  sweepCounts(): SweepCounts {
    return installed?.sweepCounts() ?? emptyCounts()
  },
  /** One of the lines that always fire; see `MARKER` in `@session/logging`. */
  marker(category: string, name: string, fields?: LogFields): void {
    const wallMs = Date.now()
    withLogger((logger) => {
      logger.at(wallMs).marker(category, name, fields)
    })
  },
}

/**
 * The store's `log` option: every line to the file, and to the console as well where `echo` is
 * set, a development build. The console's four levels take the six: `critical` as an error, and
 * `trace` as debug.
 */
export function storeLogger(
  echo: boolean,
): (level: LogLevel, category: string, message: string, op?: string) => void {
  return (level, category, message, op) => {
    appLog.log(level, category, message, undefined, op)
    if (echo) {
      const method = level === 'critical' ? 'error' : level === 'trace' ? 'debug' : level
      console[method](`[${category}] ${message}`)
    }
  }
}

/** The two things about the store's state that the markers follow. */
interface Milestones {
  startupError: string | null
  account: { haveAccount: boolean } | null
}

/**
 * The store's milestones as markers: whether the start succeeded, and whether there is an account.
 *
 * Watched from outside rather than logged by the store, because a marker is a promise that the
 * line exists, and the store's own log calls can be filtered by level.
 */
export function logStoreMilestones(store: {
  subscribe(listener: (state: Milestones, previous: Milestones) => void): () => void
}): () => void {
  return store.subscribe((state, previous) => {
    if (state.startupError !== null && state.startupError !== previous.startupError) {
      appLog.marker('session', 'start failed', { reason: state.startupError })
    }
    if (state.account !== null && previous.account === null) {
      appLog.marker('session', 'start ok')
      appLog.marker('session', state.account.haveAccount ? 'account loaded' : 'account none')
    } else if (state.account?.haveAccount === true && previous.account?.haveAccount === false) {
      appLog.marker('session', 'account created')
    }
  })
}

/** What only the platform can say about itself, for the startup block. */
export interface PlatformFacts extends DeviceFacts, Pick<StartupFacts, 'previousRun'> {
  /** When this process started, as the platform measures it. */
  launchedAtMs: number
  /** The network settings the bridge was opened with, as this platform read them. */
  network: NetworkSettings
  /** Every `EXPO_PUBLIC_SESSION_FLAG_` variable the build was made with; see `flagOverrideRows`. */
  flagVariables: Readonly<Record<string, string | undefined>>
}

/**
 * The top of a launch's file: the startup block, then the `launch` marker - and then installs the
 * logger, so whatever was held while the directory opened follows the block rather than coming
 * before it.
 *
 * Shared so every platform's block says the same things in the same order; the ports supply the
 * build and the flags, and the platform the rest. Null facts write the marker alone, for a process
 * whose block another process writes: desktop's renderer, whose main process wrote it first.
 */
export function startLogger(
  logger: Logger,
  facts: PlatformFacts | null,
  launchFields?: LogFields,
): void {
  if (facts !== null) {
    const { build } = requirePorts()
    const network = networkRows(facts.network)
    logger.section(
      startupBlock({
        ...build,
        ...facts,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        ...network,
        flagOverrides: flagOverrideRows(facts.flagVariables),
      }),
    )
  }
  logger.marker('lifecycle', 'launch', launchFields)
  installLogger(logger)
}
