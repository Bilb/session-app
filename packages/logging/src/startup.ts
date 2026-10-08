import type { PreviousRun } from './writer'

/** What a launch says about itself before anything else, so every file opens with its context. */
export interface StartupFacts {
  version: string
  buildNumber: string | null
  commit: string | null
  /** What the build was made as - `store`, `testflight`, `website`... - or `unknown`. */
  variant: string
  /** Where the platform says it was installed from, or `unknown`. */
  install: string
  platform: string
  osVersion: string
  model: string
  locale: string
  utcOffsetMinutes: number
  network: string
  /** `NAME=value` for each flag overridden in this build's environment. */
  flagOverrides: readonly string[]
  /** The libsession log spec in force, as written: `info,network=debug`. */
  logSpec: string
  previousRun: PreviousRun | null
}

/** `UTC+10:00`, `UTC-03:30`, `UTC+00:00`. */
export function utcOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

/** Label column wide enough for the longest label, so the values line up. */
const LABEL_WIDTH = 13

function row(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`
}

/** `1.0.0 (123)`, or the version alone where there is no build number. */
export function versionText(version: string, buildNumber: string | null): string {
  return buildNumber === null ? version : `${version} (${buildNumber})`
}

function previousRunText(previous: PreviousRun | null): string {
  if (previous === null) return 'none - first run with logs'
  const ending = previous.endedCleanly
    ? 'ended cleanly'
    : `did not end cleanly (last marker: ${previous.lastMarker ?? 'none'})`
  return `${previous.file} · ${ending}`
}

/**
 * The block at the top of every launch's file, written as lines after the usual prefix:
 *
 * ```
 * ──── Session 1.0.0 (123) launched ────
 *   App          1.0.0 (123) · commit 833d55d5-dirty · variant testflight
 *   ...
 * ```
 *
 * For people first: support reads it before anything else in a report, and the legacy iOS block
 * it follows was the part of those reports nobody had to decode.
 */
export function startupBlock(facts: StartupFacts): string[] {
  const version = versionText(facts.version, facts.buildNumber)
  const app = [version, `commit ${facts.commit ?? 'unknown'}`, `variant ${facts.variant}`]
  return [
    `──── Session ${version} launched ────`,
    row('App', app.join(' · ')),
    row('Install', facts.install),
    row('Device', `${facts.model} · ${facts.platform} ${facts.osVersion}`),
    row('Locale', `${facts.locale} · ${utcOffset(facts.utcOffsetMinutes)}`),
    row('Network', facts.network),
    row(
      'Flags',
      facts.flagOverrides.length === 0 ? 'none overridden' : facts.flagOverrides.join(' · '),
    ),
    row('Log level', facts.logSpec),
    row('Previous run', previousRunText(facts.previousRun)),
  ]
}
