import { utcOffset, versionText } from './startup'
import type { SweepCounts } from './sweep'
import type { LogFields } from './values'
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

/**
 * Bytes to two significant figures: `48 MB`, `1.2 kB`, `310 MB`.
 *
 * For what could fingerprint a device or describe an account - free space, database and cache
 * sizes - where the exact figure would link two exports and the rough one is all support needs.
 */
export function roughBytes(bytes: number): string {
  if (bytes < 1000) return formatBytes(bytes)
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  const rounded = Number(value.toPrecision(2))
  return `${rounded >= 10 ? rounded.toFixed(0) : rounded.toFixed(1)} ${units[unit] ?? ''}`
}

/**
 * A config's size as a bucket rather than a number: a contacts config's exact size is close to a
 * count of somebody's contacts, and support only needs to see that one has grown unexpectedly.
 */
export function sizeBucket(bytes: number): string {
  if (bytes < 2_000) return 'small'
  if (bytes < 20_000) return 'medium'
  if (bytes < 200_000) return 'large'
  return 'very large'
}

/** The database's three files, which together say whether checkpointing is keeping up. */
export interface DatabaseSizes {
  databaseBytes: number
  walBytes: number | null
  shmBytes: number | null
}

/**
 * The fields of a database line - `database open db="48 MB" wal=1204224 shm=32768` - logged when
 * the database opens and when the app goes to the background, as legacy iOS did. The journals are
 * exact, because a WAL that keeps growing between lines is a checkpoint that is not happening; the
 * database itself is rough, like everything that describes how much somebody has.
 */
export function databaseFields(sizes: DatabaseSizes | null): LogFields {
  if (sizes === null) return { db: 'none' }
  return { db: roughBytes(sizes.databaseBytes), wal: sizes.walBytes, shm: sizes.shmBytes }
}

/** What is known at export time. Null is "the platform cannot say"; absent is "does not apply". */
export interface ExportFacts {
  exportedAtMs: number
  utcOffsetMinutes: number
  version: string
  buildNumber: string | null
  commit: string | null
  libsessionCommit: string | null
  variant: string
  install: string
  model: string
  /** `iOS 26.1`, `macOS 15.1`, `Linux 6.8.0-45-generic`. */
  os: string
  locale: string
  /** Rows only some platforms have: Linux's distro and display server, a phone's low power mode. */
  platformRows: ReadonlyArray<readonly [string, string]>
  network: string
  networkType: string | null
  /** Total only where the device does not imply it, which is the desktop. */
  memory: { usedBytes: number | null; availableBytes: number | null; totalBytes?: number }
  notifications?: string
  /** Permission name to state, in the order they should be listed. */
  permissions?: ReadonlyArray<readonly [string, string]>
  storage: {
    database: DatabaseSizes | null
    attachmentsBytes: number | null
    attachmentsLimitBytes: number | null
    freeBytes: number | null
  }
  /** Each config and its size; null until libsession reports them. */
  configSizes: ReadonlyArray<{ name: string; bytes: number }> | null
  logs: {
    plan: ExportPlan
    firstLine: string | null
    lastLine: string | null
  }
  /** What the sweep replaced in this run, before the export. */
  redactions: SweepCounts
}

/** Full width, so the header is unmistakably the top of an export and not a launch. */
const RULE = '='.repeat(100)
const LABEL_WIDTH = 15
const NESTED_WIDTH = 15

function row(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`
}

/** A heading row and its items, each on its own line beneath it. */
function group(label: string, items: ReadonlyArray<readonly [string, string]>): string[] {
  return [`  ${label}`, ...items.map(([name, value]) => `    ${name.padEnd(NESTED_WIDTH)}${value}`)]
}

const rough = (value: number | null): string => (value === null ? 'unknown' : roughBytes(value))

/** The UTC timestamp a log line starts with, readable, or null for a line that has none. */
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
 * Wrapped in full-width rules so it cannot be mistaken for a launch, whose block opens with only an
 * empty line. One item per line, with lists nested under their heading, because a row of
 * separated values is hard to read. Follows legacy iOS's summary and adds what support has asked
 * for since: the libsession commit, the database's journals, config sizes as buckets, what was left
 * out, and how often the sweep had to step in.
 */
export function exportHeader(facts: ExportFacts): string[] {
  const at = new Date(facts.exportedAtMs).toISOString()
  const { plan } = facts.logs
  const { storage, memory } = facts
  const version = versionText(facts.version, facts.buildNumber)
  const omittedBytes = plan.omitted.reduce((sum, file) => sum + file.sizeBytes, 0)
  const redactions = Object.entries(facts.redactions).filter(([, count]) => count > 0)
  const database = storage.database

  return [
    RULE,
    `Session logs exported ${at.slice(0, 10)} ${at.slice(11, 19)}Z ` +
      `(${localTime(facts.exportedAtMs, facts.utcOffsetMinutes)} local, ${utcOffset(facts.utcOffsetMinutes)})`,
    RULE,
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
    row('Connection', facts.networkType ?? 'unknown'),
    ...group('Memory', [
      ['Used', rough(memory.usedBytes)],
      ['Available', rough(memory.availableBytes)],
      ...(memory.totalBytes === undefined
        ? []
        : [['Total', roughBytes(memory.totalBytes)] as const]),
    ]),
    ...(facts.notifications === undefined ? [] : [row('Notifications', facts.notifications)]),
    ...(facts.permissions === undefined ? [] : group('Permissions', facts.permissions)),
    ...group('Storage', [
      ['Database', database === null ? 'unknown' : roughBytes(database.databaseBytes)],
      ...(database === null
        ? []
        : [['WAL', rough(database.walBytes)] as const, ['SHM', rough(database.shmBytes)] as const]),
      [
        'Attachments',
        rough(storage.attachmentsBytes) +
          (storage.attachmentsLimitBytes === null
            ? ''
            : ` (limit ${roughBytes(storage.attachmentsLimitBytes)})`),
      ],
      ['Free', rough(storage.freeBytes)],
    ]),
    ...(facts.configSizes === null
      ? [row('Config sizes', 'unknown (libsession does not report them yet)')]
      : group(
          'Config sizes',
          facts.configSizes.map(({ name, bytes }) => [name, sizeBucket(bytes)] as const),
        )),
    ...group('Logs', [
      ['Files', String(plan.included.length)],
      ['From', lineTime(facts.logs.firstLine) ?? 'unknown'],
      ['To', lineTime(facts.logs.lastLine) ?? 'unknown'],
      ['Size', roughBytes(plan.bytes)],
      [
        'Left out',
        plan.omitted.length === 0
          ? 'nothing'
          : `${String(plan.omitted.length)} older files (${roughBytes(omittedBytes)})`,
      ],
    ]),
    ...(redactions.length === 0
      ? [row('Redactions', 'none this run')]
      : group(
          'Redactions (this run)',
          redactions.map(([kind, count]) => [kind, String(count)] as const),
        )),
    RULE,
    '',
  ]
}

/**
 * The line before a file that continues a launch past a rotation. A launch's first file needs
 * none: it opens with its own startup block, which is what a reader splits on.
 */
export function continuationLine(name: string): string | null {
  return /-0\.log$/.test(name) ? null : `── continued in ${name}`
}

/** Header, then each file, oldest first: what the platform compresses, in order. */
export function exportParts(header: readonly string[], plan: ExportPlan): ExportPart[] {
  return [
    { text: `${header.join('\n')}\n` },
    ...plan.included.flatMap((file): ExportPart[] => {
      const continued = continuationLine(file.name)
      return continued === null
        ? [{ file: file.name }]
        : [{ text: `${continued}\n` }, { file: file.name }]
    }),
  ]
}
