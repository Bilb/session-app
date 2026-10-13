import { describe, expect, it } from 'vitest'

import {
  databaseFields,
  exportFileName,
  exportHeader,
  exportParts,
  isExportName,
  planExport,
  sizeBucket,
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

  it('makes names that isExportName recognises, so an earlier export can be swept', () => {
    expect(isExportName(exportFileName('iOS', '1.0.0', AT))).toBe(true)
    expect(isExportName(exportFileName('Android', '1.2.3 (45)', AT))).toBe(true)
    expect(isExportName(exportFileName('unknown', '0.0.0', AT))).toBe(true)
  })

  it('recognises nothing else', () => {
    expect(isExportName('session-20261009T074102Z-0.log')).toBe(false)
    expect(isExportName('session-logs-ios-1.0.0-20261009T074102Z.log.gz.tmp')).toBe(false)
    expect(isExportName('photo.jpg')).toBe(false)
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

  it('includes a file that exactly meets the budget', () => {
    const plan = planExport(files, 30)
    expect(plan.included.map((f) => f.name)).toEqual(['a', 'b', 'c'])
    expect(plan.omitted).toEqual([])
    expect(plan.bytes).toBe(30)
    expect(planExport(files, 29).omitted.map((f) => f.name)).toEqual(['a'])
  })

  it('plans nothing when there are no files', () => {
    expect(planExport([], 100)).toEqual({ included: [], omitted: [], bytes: 0 })
  })
})

function facts(overrides: Partial<ExportFacts> = {}): ExportFacts {
  return {
    exportedAtMs: AT,
    utcOffsetMinutes: 600,
    version: '1.0.0',
    buildNumber: '123',
    commit: '833d55d5',
    libsessionCommit: '76d93c51',
    variant: 'testflight',
    install: 'testflight',
    model: 'iPhone17,1',
    os: 'iOS 26.1',
    locale: 'en-AU',
    platformRows: [['Low power', 'off']],
    network: 'mainnet',
    networkType: 'wifi',
    memory: { usedBytes: 212_000_000, availableBytes: 1_934_000_000 },
    permissions: [
      ['Camera', 'granted'],
      ['Microphone', 'not asked'],
    ],
    storage: {
      database: { databaseBytes: 48_234_496, walBytes: 1_204_224, shmBytes: 32_768 },
      attachmentsBytes: 312_400_000,
      attachmentsLimitBytes: 1_000_000_000,
      freeBytes: 41_234_000_000,
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

describe('sizeBucket', () => {
  it("draws contacts' lines where a change starts to cost, and where it goes multipart", () => {
    expect(sizeBucket('contacts', 19_999)).toBe('small')
    expect(sizeBucket('contacts', 20_000)).toBe('medium')
    // A dump this size compresses past the storage server's 76.8 kB message limit.
    expect(sizeBucket('contacts', 128_000)).toBe('large')
    expect(sizeBucket('contacts', 512_000)).toBe('very large')
  })

  it('draws them lower for what changes on every read', () => {
    expect(sizeBucket('convo_info_volatile', 20_000)).toBe('medium')
    expect(sizeBucket('convo_info_volatile', 40_000)).toBe('large')
    expect(sizeBucket('convo_info_volatile', 128_000)).toBe('very large')
  })

  it('draws them by count for groups, every one of which is a swarm to poll', () => {
    // ~215 bytes a group: 10, 50 and 200 of them.
    expect(sizeBucket('user_groups', 215 * 9)).toBe('small')
    expect(sizeBucket('user_groups', 215 * 10)).toBe('medium')
    expect(sizeBucket('user_groups', 215 * 51)).toBe('large')
    expect(sizeBucket('user_groups', 215 * 205)).toBe('very large')
  })

  it('treats any growth of a fixed-size config as worth seeing', () => {
    expect(sizeBucket('user_profile', 300)).toBe('small')
    expect(sizeBucket('local', 9_000)).toBe('large')
    expect(sizeBucket('a_config_added_later', 300)).toBe('small')
  })
})

describe('exportHeader', () => {
  it('keeps a long name apart from its value, and the group aligned', () => {
    const header = exportHeader(
      facts({
        configSizes: [
          { name: 'contacts', bytes: 300 },
          { name: 'convo_info_volatile', bytes: 300 },
        ],
      }),
    )
    expect(header).toContain('    contacts             small')
    expect(header).toContain('    convo_info_volatile  small')
  })

  it('is wrapped in full-width rules with one item per line', () => {
    const header = exportHeader(facts())
    expect(header[0]).toBe('='.repeat(100))
    expect(header[1]).toBe('Session logs exported 2026-10-09 07:41:02Z (17:41 local, UTC+10:00)')
    expect(header[2]).toBe('='.repeat(100))
    expect(header.slice(3, 15)).toEqual([
      '  Version        1.0.0 (123)',
      '  Commit         833d55d5',
      '  libsession     76d93c51',
      '  Variant        testflight',
      '  Install        testflight',
      '  Device         iPhone17,1',
      '  OS             iOS 26.1',
      '  Low power      off',
      '  Time           en-AU · UTC+10:00',
      '  Network        mainnet',
      '  Connection     wifi',
      '  Memory',
    ])
    expect(header.at(-2)).toBe('='.repeat(100))
  })

  it('nests lists under their heading and rounds what could identify', () => {
    const header = exportHeader(facts())
    const storage = header.indexOf('  Storage')
    expect(header.slice(storage, storage + 6)).toEqual([
      '  Storage',
      '    Database       48 MB',
      '    WAL            1.2 MB',
      '    SHM            33 kB',
      '    Attachments    310 MB (limit 1.0 GB)',
      '    Free           41 GB',
    ])
    expect(header).toContain('    Camera         granted')
    expect(header).toContain('    Used           210 MB')
    expect(header.some((line) => line.includes('Total'))).toBe(false)
  })

  it('gives config sizes as buckets', () => {
    const header = exportHeader(
      facts({
        configSizes: [
          { name: 'contacts', bytes: 78_000 },
          { name: 'local', bytes: 90 },
        ],
      }),
    )
    const start = header.indexOf('  Config sizes')
    expect(header.slice(start, start + 3)).toEqual([
      '  Config sizes',
      '    contacts       medium',
      '    local          small',
    ])
  })

  it('says what the logs cover and what was left out', () => {
    const header = exportHeader(facts())
    const logs = header.indexOf('  Logs')
    expect(header.slice(logs, logs + 6)).toEqual([
      '  Logs',
      '    Files          1',
      '    From           2026-10-07 22:14:03Z',
      '    To             2026-10-09 07:41:01Z',
      '    Size           2.0 MB',
      '    Left out       nothing',
    ])
    expect(header).toContain('    hex            12')
  })

  it('says how many older files were left out, and how much they came to', () => {
    const plan = planExport(
      [
        file('session-20261005T000000Z-0.log', 1_500_000),
        file('session-20261006T000000Z-0.log', 1_500_000),
        file('session-20261007T221403Z-0.log', 2_000_000),
      ],
      2_000_000,
    )
    const header = exportHeader(facts({ logs: { plan, firstLine: null, lastLine: null } }))
    expect(header).toContain('    Files          1')
    expect(header).toContain('    Left out       2 older files (3.0 MB)')
    expect(header).toContain('    From           unknown')
  })

  it('heads an export with no files', () => {
    const header = exportHeader(
      facts({ logs: { plan: planExport([]), firstLine: null, lastLine: null } }),
    )
    expect(header).toContain('    Files          0')
    expect(header).toContain('    Size           0 B')
    expect(header).toContain('    Left out       nothing')
  })

  it('leaves out what does not apply and says unknown for what cannot be read', () => {
    const { permissions: _permissions, ...rest } = facts({
      memory: { usedBytes: null, availableBytes: null, totalBytes: 8_000_000_000 },
      storage: {
        database: null,
        attachmentsBytes: null,
        attachmentsLimitBytes: null,
        freeBytes: null,
      },
      redactions: emptyCounts(),
    })
    const header = exportHeader(rest)
    expect(header.some((line) => line.includes('Permissions'))).toBe(false)
    expect(header).toContain('    Used           unknown')
    expect(header).toContain('    Total          8.0 GB')
    expect(header).toContain('    Database       unknown')
    expect(header.some((line) => line.includes('WAL'))).toBe(false)
    expect(header).toContain('  Redactions     none this run')
  })
})

describe('databaseFields', () => {
  it('rounds the database and keeps the journals exact', () => {
    expect(
      databaseFields({ databaseBytes: 48_234_496, walBytes: 1_204_224, shmBytes: 32_768 }),
    ).toEqual({ db: '48 MB', wal: 1_204_224, shm: 32_768 })
    expect(databaseFields(null)).toEqual({ db: 'none' })
  })
})

describe('exportParts', () => {
  it('puts the header first and marks only the files that continue a launch', () => {
    const plan = planExport([
      file('session-20261009T000000Z-0.log', 1),
      file('session-20261009T000000Z-1.log', 1),
    ])
    expect(exportParts(['H'], plan)).toEqual([
      { text: 'H\n' },
      { file: 'session-20261009T000000Z-0.log' },
      { text: '── continued in session-20261009T000000Z-1.log\n' },
      { file: 'session-20261009T000000Z-1.log' },
    ])
  })
})
