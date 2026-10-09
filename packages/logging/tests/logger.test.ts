import { describe, expect, it } from 'vitest'

import {
  createForwardingLogger,
  createLogger,
  parseRecord,
  type LogRecord,
  type LogSink,
} from '#src/logger'
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

  it('writes a section without the prefix, swept, and as urgent', () => {
    const sink = recording()
    logger(sink).section(['', 'Device  iPhone', `Account ${ACCOUNT}`])
    expect(sink.lines).toEqual(['', 'Device  iPhone', 'Account 05cd90...cd90'])
    expect(sink.urgent).toEqual([true])
  })

  it('carries a request id in its column', () => {
    const sink = recording()
    const log = logger(sink)
    log.log('info', 'network', 'request ok', { status: 200 }, 'CoS-0-I7C3')
    expect(sink.lines[0]).toContain('[network]        [CoS-0-I7C3]     request ok status=200')
  })
})

describe('a line logged in one process and written by another', () => {
  function forwarded() {
    const records: LogRecord[] = []
    const urgent: boolean[] = []
    const forwarding = createForwardingLogger({
      send: (record, isUrgent) => {
        // Through structured clone's eyes: plain data only, nothing of the class survives.
        records.push(JSON.parse(JSON.stringify(record)) as LogRecord)
        urgent.push(isUrgent)
      },
      now: () => AT,
      uptimeMs: () => 12_345,
    })
    return { forwarding, records, urgent }
  }

  it('is written exactly as the writing process would have written it', () => {
    const { forwarding, records } = forwarded()
    const fields = { account: accountId(ACCOUNT), node: internalId('ab'.repeat(32), 'snode') }
    forwarding.info('network', `sent to ${'ef'.repeat(32)}`, fields)

    const direct = recording()
    logger(direct).info('network', `sent to ${'ef'.repeat(32)}`, fields)

    const written = recording()
    const writer = logger(written)
    for (const record of records) {
      const parsed = parseRecord(record)
      if (parsed !== null) writer.record(parsed)
    }
    expect(written.lines).toEqual(direct.lines)
  })

  it('is timed where it was logged, not where it is written', () => {
    const { forwarding, records } = forwarded()
    forwarding.warn('ui', 'slow frame')
    const written = recording()
    createLogger({
      sink: written,
      pseudonyms: pseudonyms(),
      now: () => AT + 60_000,
      uptimeMs: () => 99_999,
    }).record(records[0]!)
    expect(written.lines[0]).toMatch(/^2026-10-08T03:20:09\.123Z\s+\+12\.345 WARN /)
  })

  it('carries markers as markers, urgent and past any level', () => {
    const { forwarding, records, urgent } = forwarded()
    forwarding.marker('lifecycle', 'launch', { process: 'renderer' })
    expect(urgent).toEqual([true])
    const written = recording()
    createLogger({
      sink: written,
      pseudonyms: pseudonyms(),
      now: () => AT,
      uptimeMs: () => 0,
      minLevel: () => 'critical',
    }).record(records[0]!)
    expect(written.lines[0]).toContain('>>> launch process=renderer')
    expect(written.urgent).toEqual([true])
  })

  it('never sweeps or counts in the process that logged it', () => {
    const { forwarding } = forwarded()
    forwarding.info('network', `node ${'ab'.repeat(32)}`)
    expect(forwarding.sweepCounts().hex).toBe(0)
  })
})

describe('parseRecord', () => {
  const valid = { wallMs: AT, uptimeMs: 1, level: 'info', category: 'ui', message: 'hi' }

  it('takes a well-formed record', () => {
    expect(parseRecord(valid)).toEqual(valid)
  })

  it.each([
    ['not an object', 'hello'],
    ['no time', { ...valid, wallMs: undefined }],
    ['a time that is not a number', { ...valid, wallMs: 'now' }],
    ['an unknown level', { ...valid, level: 'loud' }],
    ['a message that is not a string', { ...valid, message: 42 }],
    ['an unknown kind', { ...valid, kind: 'banner' }],
  ])('refuses %s', (_name, record) => {
    expect(parseRecord(record)).toBeNull()
  })

  it('drops a field that is not a value, and keeps the rest of the line', () => {
    const parsed = parseRecord({
      ...valid,
      fields: { ok: 3, forged: { redacted: 'visible', raw: 7 }, also: { toString: 'x' } },
    })
    expect(parsed?.fields).toEqual({ ok: 3 })
  })
})
