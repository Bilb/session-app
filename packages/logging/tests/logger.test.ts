import { describe, expect, it } from 'vitest'

import { createLogger, type LogSink } from '#src/logger'
import { accountId, address, internalId, url } from '#src/values'

import { pseudonyms } from './helpers'

const AT = Date.UTC(2026, 9, 8, 3, 20, 9, 123)
const ACCOUNT = `05${'cd90'.repeat(16)}`

function recording(): LogSink & { lines: string[]; urgent: boolean[] } {
  const lines: string[] = []
  const urgent: boolean[] = []
  return {
    lines,
    urgent,
    write: (written, isUrgent) => {
      lines.push(...written)
      urgent.push(isUrgent)
    },
  }
}

function logger(sink: LogSink, minLevel: 'trace' | 'info' = 'info') {
  return createLogger({
    sink,
    pseudonyms: pseudonyms(),
    now: () => AT,
    uptimeMs: () => 12_345,
    minLevel: () => minLevel,
  })
}

describe('createLogger', () => {
  it('writes the prefix, the message and the pairs', () => {
    const sink = recording()
    logger(sink).info('network', 'path built', { hops: 3, ms: 812 })
    expect(sink.lines).toEqual([
      '2026-10-08T03:20:09.123Z     +12.345 INFO  [network]                         path built hops=3 ms=812',
    ])
  })

  it('renders each kind of identifier by its type', () => {
    const sink = recording()
    const p = pseudonyms()
    logger(sink).info('send', 'send start', {
      to: accountId(ACCOUNT),
      dest: internalId('node-ed25519-key', 'snode'),
      addr: address('144.76.164.202', 22021),
      at: url('https://filev2.getsession.org/file/abcdefghijklmnopqrstuvwxyz'),
    })
    expect(sink.lines[0]?.slice(77)).toBe(
      `send start to=05cd90...cd90 dest=snode${p.of('node-ed25519-key')} addr="v4 public:22021" ` +
        `at=https://filev2.getsession.org/file/${p.of('abcdefghijklmnopqrstuvwxyz')}`,
    )
  })

  it('sweeps strings in pairs as well as the message', () => {
    const sink = recording()
    const log = logger(sink)
    log.warn('store', `failed for ${ACCOUNT}`, { peer: ACCOUNT })
    expect(sink.lines[0]).not.toContain(ACCOUNT)
    expect(log.sweepCounts().hex).toBe(2)
  })

  it('drops what is below the level, and keeps every level word', () => {
    const sink = recording()
    const log = logger(sink)
    log.debug('ui', 'hidden')
    log.critical('ui', 'shown')
    expect(sink.lines).toHaveLength(1)
    expect(sink.lines[0]).toContain(' CRIT  [ui]')
  })

  it('writes markers whatever the level, urgently, with the marker token', () => {
    const sink = recording()
    const log = createLogger({
      sink,
      pseudonyms: pseudonyms(),
      now: () => AT,
      uptimeMs: () => 0,
      minLevel: () => 'critical',
    })
    log.marker('lifecycle', 'background')
    expect(sink.lines[0]).toContain('[lifecycle]                       >>> background')
    expect(sink.urgent).toEqual([true])
  })

  it('asks for errors to be flushed at once and lets the rest wait', () => {
    const sink = recording()
    const log = logger(sink)
    log.info('ui', 'a')
    log.error('ui', 'b')
    expect(sink.urgent).toEqual([false, true])
  })

  it('mints distinct operation ids', () => {
    const log = logger(recording())
    const ops = new Set(Array.from({ length: 100 }, () => log.newOp()))
    expect(ops.size).toBe(100)
    for (const op of ops) expect(op).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('carries an op id in its column', () => {
    const sink = recording()
    const log = logger(sink)
    log.log('info', 'network', 'request ok', { status: 200 }, '#41c2e0')
    expect(sink.lines[0]).toContain('[network]        [#41c2e0]        request ok status=200')
  })
})
