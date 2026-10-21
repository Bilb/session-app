import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { updateLayerKey } from '#src/updateIndicatorTiming'

describe('what starts a new cross-fade layer', () => {
  it('is a change of state', () => {
    expect(updateLayerKey({ kind: 'available' }, false)).not.toBe(
      updateLayerKey({ kind: 'ready' }, false),
    )
  })

  it('is not a download moving on, which redraws its ring in place', () => {
    expect(updateLayerKey({ kind: 'downloading', progress: 0.1 }, false)).toBe(
      updateLayerKey({ kind: 'downloading', progress: 0.9 }, false),
    )
  })

  it('is a download switching between its glyph and its percentage', () => {
    expect(updateLayerKey({ kind: 'downloading', progress: 0.5 }, false)).not.toBe(
      updateLayerKey({ kind: 'downloading', progress: 0.5 }, true),
    )
  })

  it('ignores the percentage outside a download', () => {
    expect(updateLayerKey({ kind: 'ready' }, true)).toBe(updateLayerKey({ kind: 'ready' }, false))
  })
})

/**
 * Held by reading the source, as the tooltip's are: `packages/ui` renders nothing in its unit tier.
 */
describe('the indicator on both platforms', () => {
  const dir = join(import.meta.dirname, '../src')
  const halves = ['UpdateIndicator.tsx', 'UpdateIndicator.native.tsx'].map((name) =>
    readFileSync(join(dir, name), 'utf8'),
  )

  it('fades with the same timing and draws the same glyphs', () => {
    for (const half of halves) {
      expect(half).toContain("from './updateIndicatorTiming'")
      expect(half).toContain('UPDATE_FADE_MS')
      expect(half).toContain('<UpdateGlyph')
    }
  })

  it('drops a departed layer on a timer that a progress update does not clear', () => {
    const hook = readFileSync(join(dir, 'crossfadeLayers.ts'), 'utf8')
    expect(hook).toContain('timers.current.add(timer)')
    expect(hook).not.toMatch(/return \(\) => \{\s*clearTimeout\(timer\)/)
  })
})
