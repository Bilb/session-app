import {
  networkRows,
  startupBlock,
  type LogFields,
  type Logger,
  type LogLevel,
  type NetworkSettings,
  type PreviousRun,
} from '@session/logging'

import { FLAGS, envVarFor, flag, type FlagName } from './flags'
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
  /** One of the lines that always fire; see `MARKER` in `@session/logging`. */
  marker(category: string, name: string, fields?: LogFields): void {
    const wallMs = Date.now()
    withLogger((logger) => {
      logger.at(wallMs).marker(category, name, fields)
    })
  },
}

/** `name=value` for every flag this build's environment overrides, for the startup block. */
export function overriddenFlags(): string[] {
  const { flags } = requirePorts()
  return (Object.keys(FLAGS) as FlagName[]).flatMap((name) =>
    flags.override(envVarFor(name)) === null ? [] : [`${name}=${String(flag(name))}`],
  )
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
export interface PlatformFacts {
  /** When this process started, as the platform measures it. */
  launchedAtMs: number
  /** `iPhone17,1`, `Google Pixel 9`. */
  model: string
  /** `iOS 26.1`, `Android 16 (API 36)`. */
  os: string
  locale: string
  /** Where the OS says the app came from, or `unknown`. */
  install: string
  /** Rows only this platform has: a phone's low power mode. */
  platformRows: ReadonlyArray<readonly [string, string]>
  /** The network settings the bridge was opened with, as this platform read them. */
  network: NetworkSettings
  previousRun: PreviousRun | null
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
        launchedAtMs: facts.launchedAtMs,
        version: build.version,
        buildNumber: build.buildNumber,
        commit: build.commit,
        libsessionCommit: build.libsessionCommit,
        variant: build.variant,
        install: facts.install,
        model: facts.model,
        os: facts.os,
        locale: facts.locale,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        network: network.network,
        transport: network.transport,
        networkSettings: network.networkSettings,
        platformRows: facts.platformRows,
        flagOverrides: overriddenFlags(),
        logSpec: network.logSpec,
        previousRun: facts.previousRun,
      }),
    )
  }
  logger.marker('lifecycle', 'launch', launchFields)
  installLogger(logger)
}
