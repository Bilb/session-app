import { parseNetworkName, parseRouterKind } from '@session/basic-types'
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

/** Test seam: forgets the installed logger and anything held, as a fresh process would. */
export function resetLogger(): void {
  installed = null
  held.length = 0
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

/**
 * The settings a run's network was chosen by, raw, as each app reads them from its environment.
 *
 * Read where the bridge is opened rather than from the network port, so the block says what this
 * run is attached to even where a build-time value and a runtime one could differ - a desktop dev
 * build, whose renderer's values are substituted when it is built.
 */
export interface NetworkSettings {
  fake: boolean
  netid: string | undefined
  router: string | undefined
  devnetSeedUrl: string | undefined
  fileServerUrl: string | undefined
  logSpec: string | undefined
}

const ROUTER_NAMES = { 'onion-requests': 'onion requests', 'session-router': 'Session Router' }

/**
 * The startup block's network rows: which network, which transport and whether it was chosen or
 * defaulted, then any further setting that was given. A setting added to the bridge belongs here,
 * so the block keeps saying everything a run was configured with.
 */
export function networkRows(settings: NetworkSettings): {
  network: string
  networkSettings: (readonly [string, string])[]
  logSpec: string
} {
  const logSpec =
    settings.logSpec === undefined || settings.logSpec === ''
      ? "libsession's default"
      : settings.logSpec
  if (settings.fake) return { network: 'fake (no libsession)', networkSettings: [], logSpec }
  const name = parseNetworkName(settings.netid)
  const chosen = parseRouterKind(settings.router)
  // libsession's own default: Session Router on the public networks, onion requests on a devnet.
  const router = chosen ?? (name === 'devnet' ? 'onion-requests' : 'session-router')
  const extra: (readonly [string, string])[] = []
  if (settings.devnetSeedUrl) extra.push(['Seed node', settings.devnetSeedUrl])
  if (settings.fileServerUrl) extra.push(['File server', settings.fileServerUrl])
  return {
    network: `${name} · ${ROUTER_NAMES[router]} (${chosen === undefined ? 'default' : 'set'})`,
    networkSettings: extra,
    logSpec,
  }
}

/** What only the platform can say about itself, for the startup block. */
export interface PlatformFacts {
  platform: string
  osVersion: string
  model: string
  locale: string
  /** Where the OS says the app came from, or `unknown`. */
  install: string
  /** The network settings the bridge was opened with, as this platform read them. */
  network: NetworkSettings
  previousRun: PreviousRun | null
}

/**
 * The top of a launch's file: the startup block, then the `launch` marker - and then installs the
 * logger, so whatever was held while the directory opened follows the block rather than coming
 * before it.
 *
 * Shared so the three platforms' blocks say the same things in the same order; the ports supply
 * the build, the network and the flags, and the platform the rest.
 */
export function startLogger(logger: Logger, facts: PlatformFacts): void {
  const { build } = requirePorts()
  const network = networkRows(facts.network)
  logger.block(
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
      network: network.network,
      networkSettings: network.networkSettings,
      flagOverrides: overriddenFlags(),
      logSpec: network.logSpec,
      previousRun: facts.previousRun,
    }),
  )
  logger.marker('lifecycle', 'launch')
  installLogger(logger)
}
