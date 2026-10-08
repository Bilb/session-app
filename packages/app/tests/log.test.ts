import { createLogger, Pseudonyms } from '@session/logging'
import { afterEach, describe, expect, it } from 'vitest'

import {
  appLog,
  installLogger,
  logStoreMilestones,
  networkRows,
  resetLogger,
  startLogger,
} from '#src/log'
import { resetPorts, setPorts } from '#src/ports'
import { memoryPorts } from '#src/testPorts'

function capture(): string[] {
  const lines: string[] = []
  installLogger(
    createLogger({
      sink: { write: (written) => lines.push(...written) },
      pseudonyms: new Pseudonyms(new Uint8Array(16)),
      uptimeMs: () => 0,
    }),
  )
  return lines
}

interface State {
  startupError: string | null
  account: { haveAccount: boolean } | null
}

function fakeStore() {
  let listener: ((state: State, previous: State) => void) | null = null
  let state: State = { startupError: null, account: null }
  return {
    subscribe(next: (state: State, previous: State) => void) {
      listener = next
      return () => undefined
    },
    set(patch: Partial<State>) {
      const previous = state
      state = { ...state, ...patch }
      listener?.(state, previous)
    },
  }
}

afterEach(() => {
  resetPorts()
  resetLogger()
})

describe('appLog', () => {
  it('holds lines logged before the logger arrives and writes them in order', () => {
    appLog.info('ui', 'first')
    appLog.marker('lifecycle', 'second')
    const lines = capture()
    expect(lines.map((line) => line.slice(70))).toEqual(['first', '>>> second'])
  })
})

function newLogger(lines: string[]) {
  return createLogger({
    sink: { write: (written) => lines.push(...written) },
    pseudonyms: new Pseudonyms(new Uint8Array(16)),
    uptimeMs: () => 0,
  })
}

describe('startLogger', () => {
  it('writes the startup block from the ports, then the launch marker, then what was held', () => {
    setPorts(
      memoryPorts({
        build: { version: '1.2.3', commit: 'abc12345', buildNumber: '7', variant: 'dev' },
      }),
    )
    const lines: string[] = []
    appLog.info('session', 'held')
    startLogger(newLogger(lines), {
      platform: 'iOS',
      osVersion: '26.1',
      model: 'iPhone',
      locale: 'en-AU',
      install: 'unknown',
      network: {
        fake: false,
        netid: 'testnet',
        router: undefined,
        devnetSeedUrl: undefined,
        fileServerUrl: undefined,
        logSpec: '',
      },
      previousRun: null,
    })
    const bodies = lines.map((line) => line.slice(70))
    expect(bodies[0]).toBe('──── Session 1.2.3 (7) launched ────')
    expect(bodies).toContain('  App          1.2.3 (7) · commit abc12345 · variant dev')
    expect(bodies).toContain("  Log level    libsession's default")
    expect(bodies).toContain('  Network      testnet · Session Router (default)')
    expect(bodies.slice(-2)).toEqual(['>>> launch', 'held'])
  })
})

describe('logStoreMilestones', () => {
  it('marks the start, the account, and a failed start with its reason', () => {
    const lines = capture()
    const store = fakeStore()
    logStoreMilestones(store)
    store.set({ account: { haveAccount: false } })
    store.set({ account: { haveAccount: true } })
    store.set({ startupError: 'database is locked' })
    expect(lines.map((line) => line.slice(70))).toEqual([
      '>>> start ok',
      '>>> account none',
      '>>> account created',
      '>>> start failed reason="database is locked"',
    ])
  })
})

describe('networkRows', () => {
  const none = {
    fake: false,
    netid: undefined,
    router: undefined,
    devnetSeedUrl: undefined,
    fileServerUrl: undefined,
    logSpec: undefined,
  }

  it("says which transport and whether it was chosen or libsession's default", () => {
    expect(networkRows(none).network).toBe('mainnet · Session Router (default)')
    expect(networkRows({ ...none, netid: 'devnet' }).network).toBe(
      'devnet · onion requests (default)',
    )
    expect(networkRows({ ...none, router: 'onion-requests' }).network).toBe(
      'mainnet · onion requests (set)',
    )
  })

  it('lists the further settings that were given, and the log spec', () => {
    const rows = networkRows({
      ...none,
      netid: 'devnet',
      devnetSeedUrl: 'http://10.0.0.5:22023',
      logSpec: 'info,network=debug',
    })
    expect(rows.networkSettings).toEqual([['Seed node', 'http://10.0.0.5:22023']])
    expect(rows.logSpec).toBe('info,network=debug')
  })

  it('names the fake for what it is', () => {
    expect(networkRows({ ...none, fake: true }).network).toBe('fake (no libsession)')
  })
})
