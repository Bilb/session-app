import { tr } from '@session/localization'
import { describe, expect, it } from 'vitest'

import { pathStatusLabel, pathStatusTone } from '#src/pathStatus'

describe("the onion path's dot", () => {
  it('is green with a path, amber while one is built, red with none, grey before a report', () => {
    expect(pathStatusTone('connected')).toBe('positive')
    expect(pathStatusTone('connecting')).toBe('warning')
    expect(pathStatusTone('disconnected')).toBe('danger')
    expect(pathStatusTone('unknown')).toBe('neutral')
  })

  it('names every state in words, each one differently', () => {
    const labels = (['connected', 'connecting', 'disconnected', 'unknown'] as const).map(
      pathStatusLabel,
    )
    expect(new Set(labels).size).toBe(4)
    expect(pathStatusLabel('unknown')).toBe(tr('unknown'))
  })
})
