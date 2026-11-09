import { describe, expect, it } from 'vitest'

import { stepKey, stopKey } from '#src/listFocus'

const KEYS = ['a', 'b', 'c', 'd', 'e']
const ALL = new Set(KEYS)

describe('stopKey', () => {
  it('is the entry end before any row is focused', () => {
    expect(stopKey(KEYS, ALL, null, 'last')).toBe('e')
    expect(stopKey(KEYS, ALL, null, 'first')).toBe('a')
  })

  it('is the row last focused', () => {
    expect(stopKey(KEYS, ALL, 'b', 'last')).toBe('b')
  })

  it('falls back to the entry end when the focused row has gone', () => {
    expect(stopKey(['a', 'c', 'd'], new Set(['a', 'c', 'd']), 'b', 'last')).toBe('d')
  })

  it('is the drawn row nearest the one it wants when that is not drawn', () => {
    const window = new Set(['b', 'c'])
    expect(stopKey(KEYS, window, null, 'last')).toBe('c')
    expect(stopKey(KEYS, window, 'a', 'last')).toBe('b')
  })

  it('is nothing when no row is drawn', () => {
    expect(stopKey(KEYS, new Set(), 'a', 'last')).toBeNull()
    expect(stopKey([], new Set(), null, 'first')).toBeNull()
  })
})

describe('stepKey', () => {
  it('steps either way', () => {
    expect(stepKey(KEYS, 'c', 1)).toBe('d')
    expect(stepKey(KEYS, 'c', -1)).toBe('b')
  })

  it('does not wrap', () => {
    expect(stepKey(KEYS, 'e', 1)).toBeNull()
    expect(stepKey(KEYS, 'a', -1)).toBeNull()
  })

  it('knows no step from a row it does not hold', () => {
    expect(stepKey(KEYS, 'z', 1)).toBeNull()
  })
})
