import { describe, expect, it } from 'vitest'

import { LAUNCH_PREFIX, startupBlock, utcOffset, type StartupFacts } from '#src/startup'

const FACTS: StartupFacts = {
  launchedAtMs: Date.UTC(2026, 9, 9, 7, 41, 2, 500),
  version: '1.0.0',
  buildNumber: '123',
  commit: '833d55d5-dirty',
  libsessionCommit: '76d93c51',
  variant: 'testflight',
  install: 'testflight',
  model: 'iPhone17,1',
  os: 'iOS 26.1',
  locale: 'en-AU',
  utcOffsetMinutes: 600,
  network: 'devnet',
  transport: 'onion requests (default)',
  networkSettings: [['Seed node', 'http://10.0.0.5:22023']],
  platformRows: [['Low power', 'off']],
  flagOverrides: [],
  logSpec: 'info,network=debug',
  previousRun: {
    file: 'session-20261009T011544Z-0.log',
    endedCleanly: true,
    lastMarker: 'background',
  },
}

describe('startupBlock', () => {
  it('opens with an empty line and the launch, then one item per line', () => {
    expect(startupBlock(FACTS)).toEqual([
      '',
      '── Session 1.0.0 (123) launched 2026-10-09 07:41:02Z',
      '  Version        1.0.0 (123)',
      '  Commit         833d55d5-dirty',
      '  libsession     76d93c51',
      '  Variant        testflight',
      '  Install        testflight',
      '  Device         iPhone17,1',
      '  OS             iOS 26.1',
      '  Low power      off',
      '  Time           en-AU · UTC+10:00',
      '  Network        devnet',
      '  Transport      onion requests (default)',
      '  Seed node      http://10.0.0.5:22023',
      '  Flags          none overridden',
      '  Log level      info,network=debug',
      '  Previous run   session-20261009T011544Z-0.log, ended cleanly',
    ])
  })

  it('starts its launch line with the prefix a reader can split on', () => {
    expect(startupBlock(FACTS)[1]?.startsWith(LAUNCH_PREFIX)).toBe(true)
  })

  it('leaves out the transport where there is none, and says unknown for a missing commit', () => {
    const block = startupBlock({ ...FACTS, transport: null, libsessionCommit: null, commit: null })
    expect(block.some((line) => line.includes('Transport'))).toBe(false)
    expect(block).toContain('  libsession     unknown')
    expect(block).toContain('  Commit         unknown')
  })

  it("adds the system's word on how the previous run ended, where it is about that run", () => {
    const previousRun = {
      file: 'session-20261009T011544Z-0.log',
      endedCleanly: false,
      lastMarker: 'foreground',
    }
    const exit = { reason: 'low memory', description: null, timestampMs: Date.UTC(2026, 9, 9, 2) }
    expect(startupBlock({ ...FACTS, previousRun, previousExit: exit }).at(-1)).toBe(
      '  Previous run   session-20261009T011544Z-0.log, did not end cleanly (last marker: ' +
        'foreground), exit: low memory',
    )
    expect(
      startupBlock({
        ...FACTS,
        previousExit: { ...exit, reason: 'crash', description: 'boom' },
      }).at(-1),
    ).toBe('  Previous run   session-20261009T011544Z-0.log, ended cleanly, exit: crash (boom)')
  })

  it('leaves out an exit from before the previous run launched, and one with no record', () => {
    const earlier = { reason: 'crash', description: null, timestampMs: Date.UTC(2026, 9, 9, 1) }
    const plain = '  Previous run   session-20261009T011544Z-0.log, ended cleanly'
    expect(startupBlock({ ...FACTS, previousExit: earlier }).at(-1)).toBe(plain)
    expect(startupBlock({ ...FACTS, previousExit: null }).at(-1)).toBe(plain)
    expect(startupBlock({ ...FACTS, previousRun: null, previousExit: earlier }).at(-1)).toBe(
      '  Previous run   none - first run with logs',
    )
  })

  it('writes negative and half-hour offsets', () => {
    expect(utcOffset(-210)).toBe('UTC-03:30')
    expect(utcOffset(0)).toBe('UTC+00:00')
  })
})
