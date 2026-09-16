import { describe, expect, it } from 'vitest'

import { parseLogSpec } from '#src/logSpec'

describe('parseLogSpec', () => {
  it('is unset when there is nothing to say', () => {
    expect(parseLogSpec(undefined)).toBeUndefined()
    expect(parseLogSpec('')).toBeUndefined()
    expect(parseLogSpec('  , ,')).toBeUndefined()
  })

  it('reads a bare level as the default', () => {
    expect(parseLogSpec('debug')).toEqual({ level: 'debug', categories: [] })
  })

  it('reads a default with overrides on top', () => {
    expect(parseLogSpec('warn,network=debug,client=trace')).toEqual({
      level: 'warn',
      categories: [
        { category: 'network', level: 'debug' },
        { category: 'client', level: 'trace' },
      ],
    })
  })

  it('does not care about order, because the default is applied first', () => {
    expect(parseLogSpec('network=debug,warn')).toEqual(parseLogSpec('warn,network=debug'))
  })

  it('tolerates spaces around the parts', () => {
    expect(parseLogSpec(' warn , network = debug ')).toEqual({
      level: 'warn',
      categories: [{ category: 'network', level: 'debug' }],
    })
  })

  it('passes a category it has never heard of straight through', () => {
    // No list here could be authoritative - they are declared across three repositories - and
    // libsession makes a logger for whatever it is given, which matches no line and costs nothing.
    expect(parseLogSpec('anything-at-all=debug')?.categories).toEqual([
      { category: 'anything-at-all', level: 'debug' },
    ])
  })

  it('drops an unreadable part rather than refusing to start', () => {
    const spec = parseLogSpec('warn,network=verbose,=debug,nonsense')
    expect(spec?.level).toBe('warn')
    expect(spec?.categories).toEqual([])
  })
})
