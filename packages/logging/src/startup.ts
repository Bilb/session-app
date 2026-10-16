import type { Rows } from '@session/basic-types'

import type { BuildFacts, DeviceFacts } from './facts'
import { basicUtc, LOG_FILE_NAME, type PreviousRun } from './writer'

/**
 * How the OS says the previous process ended, where it keeps a record: Android 11 and later,
 * through `ActivityManager.getHistoricalProcessExitReasons`.
 */
export interface PreviousExit {
  /** `low memory`, `crash`, `ANR`, `user requested`... */
  reason: string
  /** The system's own words, where it gave any. */
  description: string | null
  timestampMs: number
}

/** What a launch says about itself before anything else, so every file opens with its context. */
export interface StartupFacts extends BuildFacts, DeviceFacts {
  launchedAtMs: number
  utcOffsetMinutes: number
  /** `testnet`, `mainnet`, `fake (no libsession)`. */
  network: string
  /** `Session Router (default)`, or null where there is no transport - the fake. */
  transport: string | null
  /** Further network settings this run was started with, label then value; empty when none. */
  networkSettings: Rows
  /**
   * `name=value` for each flag this build's environment sets, as written, then any flag variable
   * that names no flag: see `flagOverrideRows` in `@session/app`.
   */
  flagOverrides: readonly string[]
  /** The libsession log spec in force, as written: `info,network=debug`. */
  logSpec: string
  previousRun: PreviousRun | null
  /**
   * Null where the OS has no record of the previous process; absent where it keeps none at all:
   * iOS and the desktop.
   */
  previousExit?: PreviousExit | null | undefined
}

/** `UTC+10:00`, `UTC-03:30`, `UTC+00:00`. */
export function utcOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

/**
 * What a launch's first line starts with, so `grep '^── Session'` lists every launch in a file or
 * an export, and splitting on it cuts a log into runs.
 */
export const LAUNCH_PREFIX = '── '

/** Label column wide enough for the longest label, so the values line up. */
const LABEL_WIDTH = 15

function row(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`
}

/** `1.0.0 (123)`, or the version alone where there is no build number. */
export function versionText(version: string, buildNumber: string | null): string {
  return buildNumber === null ? version : `${version} (${buildNumber})`
}

/**
 * The OS's record of how the previous run ended, where it belongs to that run: a record older than
 * the previous file's launch is of a process before it, whose own file has since been pruned.
 */
function exitText(exit: PreviousExit | null | undefined, previous: PreviousRun): string {
  if (exit === null || exit === undefined) return ''
  const launch = LOG_FILE_NAME.exec(previous.file)?.[1]
  if (launch === undefined || basicUtc(exit.timestampMs) < launch) return ''
  return `, exit: ${exit.reason}${exit.description === null ? '' : ` (${exit.description})`}`
}

function previousRunText(
  previous: PreviousRun | null,
  exit: PreviousExit | null | undefined,
): string {
  if (previous === null) return 'none - first run with logs'
  const ending = previous.endedCleanly
    ? 'ended cleanly'
    : `did not end cleanly (last marker: ${previous.lastMarker ?? 'none'})`
  return `${previous.file}, ${ending}${exitText(exit, previous)}`
}

/** `2026-10-09 07:41:02Z`: readable, and still unambiguous about its zone. */
export function readableUtc(ms: number): string {
  const iso = new Date(ms).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}Z`
}

/**
 * The block that opens every launch, written without the line prefix:
 *
 * ```
 *
 * ── Session 1.0.0 (123) launched 2026-10-09 07:41:02Z
 *   Version        1.0.0 (123)
 *   Commit         833d55d5
 *   ...
 * ```
 *
 * For people first: support reads it before anything else in a report. The empty line before it
 * is what sets one launch apart from the last when scrolling, without a rule that would draw the
 * eye the way the export's header should. One item per line, because a row of separated values is
 * hard to read.
 */
export function startupBlock(facts: StartupFacts): string[] {
  const version = versionText(facts.version, facts.buildNumber)
  return [
    '',
    `${LAUNCH_PREFIX}Session ${version} launched ${readableUtc(facts.launchedAtMs)}`,
    row('Version', version),
    row('Commit', facts.commit ?? 'unknown'),
    row('libsession', facts.libsessionCommit ?? 'unknown'),
    row('Variant', facts.variant),
    row('Install', facts.install),
    row('Device', facts.model),
    row('OS', facts.os),
    ...facts.platformRows.map(([label, value]) => row(label, value)),
    row('Time', `${facts.locale} · ${utcOffset(facts.utcOffsetMinutes)}`),
    row('Network', facts.network),
    ...(facts.transport === null ? [] : [row('Transport', facts.transport)]),
    ...facts.networkSettings.map(([label, value]) => row(label, value)),
    row(
      'Flags',
      facts.flagOverrides.length === 0 ? 'none overridden' : facts.flagOverrides.join(', '),
    ),
    row('Log level', facts.logSpec),
    row('Previous run', previousRunText(facts.previousRun, facts.previousExit)),
  ]
}
