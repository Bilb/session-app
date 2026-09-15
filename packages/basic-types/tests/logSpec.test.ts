import { describe, expect, it } from 'vitest'

import { KNOWN_LOG_CATEGORIES, parseLogSpec } from '#src/logSpec'

describe('parseLogSpec', () => {
  it('is unset when there is nothing to say', () => {
    expect(parseLogSpec(undefined)).toBeUndefined()
    expect(parseLogSpec('')).toBeUndefined()
    expect(parseLogSpec('  , ,')).toBeUndefined()
  })

  it('reads a bare level as the default', () => {
    expect(parseLogSpec('debug')).toEqual({ level: 'debug', categories: [], unknown: [] })
  })

  it('reads a default with overrides on top', () => {
    expect(parseLogSpec('warn,network=debug,client=trace')).toEqual({
      level: 'warn',
      categories: [
        { category: 'network', level: 'debug' },
        { category: 'client', level: 'trace' },
      ],
      unknown: [],
    })
  })

  it('does not care about order, because the default is applied first', () => {
    expect(parseLogSpec('network=debug,warn')).toEqual(parseLogSpec('warn,network=debug'))
  })

  it('tolerates spaces around the parts', () => {
    expect(parseLogSpec(' warn , network = debug ')).toEqual({
      level: 'warn',
      categories: [{ category: 'network', level: 'debug' }],
      unknown: [],
    })
  })

  it('reports a category nothing declares, and still applies it', () => {
    // `Cat(name)` creates a logger on demand, so a typo matches nothing and fails silently. The
    // caller is given the name so it can say so rather than the setting quietly doing nothing.
    const spec = parseLogSpec('netwrok=debug')
    expect(spec?.unknown).toEqual(['netwrok'])
    expect(spec?.categories).toEqual([{ category: 'netwrok', level: 'debug' }])
  })

  it('reports an unreadable part rather than refusing to start', () => {
    const spec = parseLogSpec('warn,network=verbose,=debug,nonsense')
    expect(spec?.level).toBe('warn')
    expect(spec?.categories).toEqual([])
    expect(spec?.unknown).toEqual(['network=verbose', '=debug', 'nonsense'])
  })

  it('knows the categories libsession actually declares', () => {
    for (const name of ['network', 'client', 'quic', 'session-router', 'snode_pool'])
      expect(KNOWN_LOG_CATEGORIES).toContain(name)
  })
})
