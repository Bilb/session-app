import { describe, expect, it } from 'vitest'

import { libsessionLine } from '#src/store'

describe('libsessionLine', () => {
  it("drops libsession's own time and uptime, keeps its level, and moves the source to the end", () => {
    expect(
      libsessionLine(
        'warning',
        '[2026-10-08 17:55:06] [+0.422s] [router:warning|router/router.cpp:459] Network ID is testnet\n',
      ),
    ).toEqual({ level: 'warn', message: 'Network ID is testnet src=router/router.cpp:459' })
  })

  it('lifts the request tag into the op', () => {
    expect(
      libsessionLine(
        'info',
        '[d] [+1.000s] [network:info|network/session_network.cpp:963] [Request CoS-0-GZHC] Starting clock resync.\n',
      ),
    ).toEqual({
      level: 'info',
      message: 'Starting clock resync. src=network/session_network.cpp:963',
      op: 'CoS-0-GZHC',
    })
  })

  it('reads the prefix whatever unit its uptime has reached', () => {
    for (const uptime of ['+0.420s', '+3m50.208s', '+1h2m3.4s']) {
      expect(
        libsessionLine(
          'info',
          `[2026-10-09 07:37:49] [${uptime}] [quic:warning|udp.cpp:339] Dropped`,
        ).message,
      ).toBe('Dropped src=udp.cpp:339')
    }
  })

  it('takes the level in the line over the one beside it', () => {
    expect(libsessionLine('info', '[d] [+1.000s] [quic:critical|loop.cpp:1] gone').level).toBe(
      'critical',
    )
  })

  it("passes a line without libsession's prefix through, trimmed", () => {
    expect(libsessionLine('err', 'plain message\n')).toEqual({
      level: 'error',
      message: 'plain message',
    })
    expect(libsessionLine('verbose', 'x').level).toBe('info')
  })
})
