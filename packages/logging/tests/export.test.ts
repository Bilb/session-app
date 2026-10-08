import { describe, expect, it } from 'vitest'

import {
  exportFileName,
  exportHeader,
  exportParts,
  formatBytes,
  planExport,
  type ExportFacts,
} from '#src/export'
import { emptyCounts } from '#src/sweep'

const AT = Date.UTC(2026, 9, 9, 7, 41, 2)

const file = (name: string, sizeBytes: number) => ({ name, sizeBytes })

describe('exportFileName', () => {
  it('has no spaces and names platform, version and time', () => {
    expect(exportFileName('iOS', '1.0.0', AT)).toBe(
      'session-logs-ios-1.0.0-20261009T074102Z.log.gz',
    )
    expect(exportFileName('macOS 15', '1.0.0 beta', AT)).toBe(
      'session-logs-macos-15-1.0.0-beta-20261009T074102Z.log.gz',
    )
  })
})

describe('planExport', () => {
  const files = [file('a', 10), file('b', 10), file('c', 10)]

  it('takes the newest first and leaves out the oldest', () => {
    const plan = planExport(files, 25)
    expect(plan.included.map((f) => f.name)).toEqual(['b', 'c'])
    expect(plan.omitted.map((f) => f.name)).toEqual(['a'])
    expect(plan.bytes).toBe(20)
  })

  it('always includes the newest file', () => {
    expect(planExport([file('huge', 100)], 10).included).toHaveLength(1)
  })

  it('includes everything that fits', () => {
    expect(planExport(files, 100).omitted).toEqual([])
  })
})

describe('formatBytes', () => {
  it('uses decimal units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1_234)).toBe('1.2 kB')
    expect(formatBytes(48_200_000)).toBe('48.2 MB')
    expect(formatBytes(312_000_000)).toBe('312 MB')
  })
})

function facts(overrides: Partial<ExportFacts> = {}): ExportFacts {
  return {
    exportedAtMs: AT,
    utcOffsetMinutes: 600,
    version: '1.0.0',
    buildNumber: '123',
    commit: '833d55d5',
    variant: 'testflight',
    install: 'testflight',
    platform: 'iOS',
    osVersion: '26.1',
    model: 'iPhone17,1',
    locale: 'en-AU',
    network: 'mainnet',
    networkType: 'wifi',
    memory: { usedBytes: 212_000_000, availableBytes: 1_900_000_000, totalBytes: 8_000_000_000 },
    permissions: [
      ['camera', 'granted'],
      ['microphone', 'not asked'],
    ],
    storage: {
      databaseBytes: 48_200_000,
      attachmentsBytes: 312_000_000,
      attachmentsLimitBytes: 1_000_000_000,
      freeBytes: 41_200_000_000,
    },
    configSizes: null,
    logs: {
      plan: planExport([file('session-20261007T221403Z-0.log', 2_000_000)]),
      firstLine: '2026-10-07T22:14:03.120Z     +0.100 INFO  ...',
      lastLine: '2026-10-09T07:41:01.990Z     +9.000 INFO  ...',
    },
    redactions: { ...emptyCounts(), hex: 12 },
    ...overrides,
  }
}

describe('exportHeader', () => {
  it('reads as the documented block', () => {
    const header = exportHeader(facts())
    expect(header[1]).toBe(
      '  Session logs · exported 2026-10-09 07:41:02 UTC (17:41 local, UTC+10:00)',
    )
    expect(header).toContain(
      '  App            Session 1.0.0 (123) · commit 833d55d5 · variant testflight',
    )
    expect(header).toContain('  Device         iPhone17,1 · iOS 26.1 · 8.0 GB RAM')
    expect(header).toContain('  Permissions    camera granted · microphone not asked')
    expect(header).toContain(
      '  Storage        database 48.2 MB · attachments 312 MB (limit 1.0 GB) · free 41.2 GB',
    )
    expect(header).toContain('  Config sizes   unknown (libsession does not report them yet)')
    const logs = header.findIndex((line) => line.startsWith('  Logs'))
    expect(header.slice(logs, logs + 2)).toEqual([
      '  Logs           1 file · 2026-10-07 22:14:03Z → 2026-10-09 07:41:01Z · 2.0 MB',
      '                 nothing left out',
    ])
    expect(header).toContain(
      '  Redactions     this run: url 0 · uuid 0 · hex 12 · base64 0 · base32 0 · ip 0 · words 0',
    )
  })

  it('leaves out what does not apply and says unknown for what cannot be read', () => {
    const { permissions: _permissions, ...rest } = facts({
      memory: { usedBytes: null, availableBytes: null, totalBytes: null },
    })
    const header = exportHeader(rest)
    expect(header.some((line) => line.includes('Permissions'))).toBe(false)
    expect(header).toContain('  Memory         unknown used · unknown available')
  })

  it('wraps a long row onto continuation lines', () => {
    const header = exportHeader(
      facts({
        configSizes: [
          'user_profile',
          'contacts',
          'convo_info_volatile',
          'user_groups',
          'groups_info',
          'groups_members',
          'groups_keys',
        ].map((type) => ({ type, bytes: 18_400 })),
      }),
    )
    const start = header.findIndex((line) => line.startsWith('  Config sizes'))
    expect(header[start + 1]?.startsWith(' '.repeat(17))).toBe(true)
    for (const line of header) expect(line.length).toBeLessThanOrEqual(98)
  })
})

describe('exportParts', () => {
  it('puts the header first and each file behind its divider', () => {
    const plan = planExport([file('a.log', 1), file('b.log', 1)])
    expect(exportParts(['H'], plan)).toEqual([
      { text: 'H\n' },
      { text: '──── a.log ────\n' },
      { file: 'a.log' },
      { text: '──── b.log ────\n' },
      { file: 'b.log' },
    ])
  })
})
