import {
  startupBlock,
  type LogFields,
  type Logger,
  type LogLevel,
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

export const appLog = {
  log(level: LogLevel, category: string, message: string, fields?: LogFields): void {
    withLogger((logger) => {
      logger.log(level, category, message, fields)
    })
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
  /** Lines written as they are after the prefix, still swept: the startup block. */
  block(category: string, lines: readonly string[]): void {
    withLogger((logger) => {
      logger.block(category, lines)
    })
  },
  /** One of the lines that always fire; see `MARKER` in `@session/logging`. */
  marker(category: string, name: string, fields?: LogFields): void {
    withLogger((logger) => {
      logger.marker(category, name, fields)
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
  platform: string
  osVersion: string
  model: string
  locale: string
  /** Where the OS says the app came from, or `unknown`. */
  install: string
  /** The libsession log spec in force, as written; empty for libsession's default. */
  logSpec: string
  previousRun: PreviousRun | null
}

/**
 * The top of a launch's file: the startup block, then the `launch` marker.
 *
 * Shared so the three platforms' blocks say the same things in the same order; the ports supply
 * the build, the network and the flags, and the platform the rest.
 */
export function logLaunch(facts: PlatformFacts): void {
  const { build, network } = requirePorts()
  appLog.block(
    'startup',
    startupBlock({
      version: build.version,
      buildNumber: build.buildNumber,
      commit: build.commit,
      variant: build.variant,
      install: facts.install,
      platform: facts.platform,
      osVersion: facts.osVersion,
      model: facts.model,
      locale: facts.locale,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
      network: network.name,
      flagOverrides: overriddenFlags(),
      logSpec: facts.logSpec === '' ? "libsession's default" : facts.logSpec,
      previousRun: facts.previousRun,
    }),
  )
  appLog.marker('lifecycle', 'launch')
}
