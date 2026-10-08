import { describe, expect, it } from 'vitest'

import { startupBlock, utcOffset } from '#src/startup'

describe('startupBlock', () => {
  it('reads as the documented block', () => {
    expect(
      startupBlock({
        version: '1.0.0',
        buildNumber: '123',
        commit: '833d55d5-dirty',
        variant: 'testflight',
        install: 'testflight',
        platform: 'iOS',
        osVersion: '26.1',
        model: 'iPhone17,1',
        locale: 'en-AU',
        utcOffsetMinutes: 600,
        network: 'mainnet',
        flagOverrides: [],
        logSpec: 'info · network=debug',
        previousRun: {
          file: 'session-20261008T011544Z-0.log',
          endedCleanly: true,
          lastMarker: 'background',
        },
      }),
    ).toEqual([
      '──── Session 1.0.0 (123) launched ────',
      '  App          1.0.0 (123) · commit 833d55d5-dirty · variant testflight',
      '  Install      testflight',
      '  Device       iPhone17,1 · iOS 26.1',
      '  Locale       en-AU · UTC+10:00',
      '  Network      mainnet',
      '  Flags        none overridden',
      '  Log level    info · network=debug',
      '  Previous run session-20261008T011544Z-0.log · ended cleanly',
    ])
  })

  it('writes negative and half-hour offsets', () => {
    expect(utcOffset(-210)).toBe('UTC-03:30')
    expect(utcOffset(0)).toBe('UTC+00:00')
  })
})
