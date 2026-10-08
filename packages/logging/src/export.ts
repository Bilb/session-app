import { utcOffset, versionText } from './startup'
import type { SweepCounts } from './sweep'
import { basicUtc, BUDGET_BYTES, type LogFileInfo } from './writer'

/**
 * One piece of an export file, in order: text the export writes itself, or a log file the platform
 * reads straight off disk. Files are named rather than read into JavaScript because twenty
 * megabytes crossing into a phone's JS thread is the cost the native compressor exists to avoid.
 */
export type ExportPart = { text: string } | { file: string }

/** `session-logs-ios-1.0.0-20261009T074102Z.log.gz`: no spaces, nothing a filesystem refuses. */
export function exportFileName(platform: string, version: string, nowMs: number): string {
  const safe = (text: string): string => text.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  return `session-logs-${safe(platform)}-${safe(version)}-${basicUtc(nowMs)}.log.gz`
}

export interface ExportPlan {
  /** Oldest first, so the export reads in time order. */
  included: LogFileInfo[]
  /** Retained but left out for size, oldest first. */
  omitted: LogFileInfo[]
  bytes: number
}

/**
 * Which files go in: chosen from the newest backwards until the budget is spent, so what is left
 * out is always the oldest. The newest file always goes in, however large.
 */
export function planExport(
  files: readonly LogFileInfo[],
  budgetBytes: number = BUDGET_BYTES,
): ExportPlan {
  const newestFirst = [...files].reverse()
  const included: LogFileInfo[] = []
  let bytes = 0
  for (const file of newestFirst) {
    if (included.length > 0 && bytes + file.sizeBytes > budgetBytes) break
    included.push(file)
    bytes += file.sizeBytes
  }
  return {
    included: included.reverse(),
    omitted: files.slice(0, files.length - included.length),
    bytes,
  }
}

/** `48.2 MB`, `312 kB`, `0 B`: decimal units, as the OS's own storage screens use. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${String(bytes)} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit] ?? ''}`
}

/** What is known at export time. Null is "the platform cannot say"; absent is "does not apply". */
export interface ExportFacts {
  exportedAtMs: number
  utcOffsetMinutes: number
  version: string
  buildNumber: string | null
  commit: string | null
  variant: string
  install: string
  platform: string
  osVersion: string
  model: string
  locale: string
  network: string
  networkType: string | null
  memory: { usedBytes: number | null; availableBytes: number | null; totalBytes: number | null }
  notifications?: string
  /** Permission name to state, in the order they should be listed. */
  permissions?: ReadonlyArray<readonly [string, string]>
  storage: {
    databaseBytes: number | null
    attachmentsBytes: number | null
    attachmentsLimitBytes: number | null
    freeBytes: number | null
  }
  /** Per config type; null until libsession can report them. */
  configSizes: ReadonlyArray<{ type: string; bytes: number }> | null
  logs: {
    plan: ExportPlan
    firstLine: string | null
    lastLine: string | null
  }
  /** What the sweep replaced in this run, before the export. */
  redactions: SweepCounts
}

const RULE = '═'.repeat(72)
const LABEL_WIDTH = 15
/** Wrap a row's items onto continuation lines past this width, so the block stays readable. */
const ROW_WIDTH = 96

function rows(label: string, items: readonly string[]): string[] {
  const lines: string[] = []
  let current = ''
  for (const item of items) {
    const next = current === '' ? item : `${current} · ${item}`
    if (current !== '' && LABEL_WIDTH + 2 + next.length > ROW_WIDTH) {
      lines.push(current)
      current = item
    } else {
      current = next
    }
  }
  if (current !== '') lines.push(current)
  return lines.map((line, index) => `  ${(index === 0 ? label : '').padEnd(LABEL_WIDTH)}${line}`)
}

const unknown = (value: number | null, format: (value: number) => string): string =>
  value === null ? 'unknown' : format(value)

/** The UTC timestamp a line starts with, or null for a line that has none. */
function lineTime(line: string | null): string | null {
  const match = line === null ? null : /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(line)
  return match === null ? null : `${match[1] ?? ''} ${match[2] ?? ''}Z`
}

function localTime(ms: number, offsetMinutes: number): string {
  return new Date(ms + offsetMinutes * 60_000).toISOString().slice(11, 16)
}

/**
 * The block at the top of an export, for people: support reads it before anything else.
 *
 * Follows legacy iOS's summary, which was the part of those reports nobody had to decode, and
 * adds what triage has asked for since - database and config sizes, the install source, what was
 * left out, and how often the redaction sweep had to step in.
 */
export function exportHeader(facts: ExportFacts): string[] {
  const at = new Date(facts.exportedAtMs).toISOString()
  const { plan } = facts.logs
  const { storage, memory } = facts
  const redactions = Object.entries(facts.redactions).map(
    ([kind, count]) => `${kind} ${String(count)}`,
  )
  const omitted =
    plan.omitted.length === 0
      ? 'nothing left out'
      : `${String(plan.omitted.length)} older files left out (${formatBytes(
          plan.omitted.reduce((sum, file) => sum + file.sizeBytes, 0),
        )})`

  return [
    RULE,
    `  Session logs · exported ${at.slice(0, 10)} ${at.slice(11, 19)} UTC ` +
      `(${localTime(facts.exportedAtMs, facts.utcOffsetMinutes)} local, ${utcOffset(facts.utcOffsetMinutes)})`,
    RULE,
    ...rows('App', [
      `Session ${versionText(facts.version, facts.buildNumber)}`,
      `commit ${facts.commit ?? 'unknown'}`,
      `variant ${facts.variant}`,
    ]),
    ...rows('Install', [facts.install]),
    ...rows('Device', [
      facts.model,
      `${facts.platform} ${facts.osVersion}`,
      ...(memory.totalBytes === null ? [] : [`${formatBytes(memory.totalBytes)} RAM`]),
    ]),
    ...rows('Memory', [
      `${unknown(memory.usedBytes, formatBytes)} used`,
      `${unknown(memory.availableBytes, formatBytes)} available`,
    ]),
    ...rows('Locale', [facts.locale, utcOffset(facts.utcOffsetMinutes)]),
    ...(facts.notifications === undefined ? [] : rows('Notifications', [facts.notifications])),
    ...(facts.permissions === undefined
      ? []
      : rows(
          'Permissions',
          facts.permissions.map(([name, state]) => `${name} ${state}`),
        )),
    ...rows('Storage', [
      `database ${unknown(storage.databaseBytes, formatBytes)}`,
      `attachments ${unknown(storage.attachmentsBytes, formatBytes)}` +
        (storage.attachmentsLimitBytes === null
          ? ''
          : ` (limit ${formatBytes(storage.attachmentsLimitBytes)})`),
      `free ${unknown(storage.freeBytes, formatBytes)}`,
    ]),
    ...rows(
      'Config sizes',
      facts.configSizes === null
        ? ['unknown (libsession does not report them yet)']
        : facts.configSizes.map(({ type, bytes }) => `${type} ${formatBytes(bytes)}`),
    ),
    ...rows('Network', [facts.network, facts.networkType ?? 'connection unknown']),
    ...rows('Logs', [
      plan.included.length === 1 ? '1 file' : `${String(plan.included.length)} files`,
      `${lineTime(facts.logs.firstLine) ?? '?'} → ${lineTime(facts.logs.lastLine) ?? '?'}`,
      `${formatBytes(plan.bytes)}`,
      omitted,
    ]),
    ...rows('Redactions', [`this run: ${redactions.join(' · ')}`]),
    RULE,
    '',
  ]
}

/** The line before each file's contents, so a reader can see where one run's file starts. */
export function fileDivider(name: string): string {
  return `──── ${name} ────`
}

/** Header, then each file behind its divider: what the platform compresses, in order. */
export function exportParts(header: readonly string[], plan: ExportPlan): ExportPart[] {
  return [
    { text: `${header.join('\n')}\n` },
    ...plan.included.flatMap((file): ExportPart[] => [
      { text: `${fileDivider(file.name)}\n` },
      { file: file.name },
    ]),
  ]
}
