import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MORPH_MS,
  MORPH_RING_MS,
  morphBetween,
  morphFrame,
  updateLayerKey,
} from '#src/updateIndicatorTiming'

describe('what starts a new cross-fade layer', () => {
  it('is a change of state', () => {
    expect(updateLayerKey({ kind: 'available' })).not.toBe(updateLayerKey({ kind: 'ready' }))
  })

  it('is not a download moving on, which redraws its ring in place', () => {
    expect(updateLayerKey({ kind: 'downloading', progress: 0.1 })).toBe(
      updateLayerKey({ kind: 'downloading', progress: 0.9 }),
    )
  })
})

describe('which changes morph rather than cross-fade', () => {
  it('is available into downloading, and a finished download into ready', () => {
    expect(morphBetween('available', 'downloading')).toBe('join')
    expect(morphBetween('downloading', 'ready')).toBe('fill')
  })

  it('is nothing else, an error included', () => {
    expect(morphBetween('downloading', 'error')).toBeNull()
    expect(morphBetween('ready', 'available')).toBeNull()
    expect(morphBetween('available', 'ready')).toBeNull()
  })
})

describe('a morph frame', () => {
  it('starts with the ring unchanged and the old glyph whole', () => {
    expect(morphFrame(0)).toEqual({ ring: 0, outgoing: 1, incoming: 0 })
  })

  it('shrinks the old glyph away before the ring has finished', () => {
    const late = morphFrame(MORPH_RING_MS * 0.8)
    expect(late.ring).toBeLessThan(1)
    expect(late.outgoing).toBe(0)
  })

  it('pops the new glyph only once the ring is done, past full size and back', () => {
    expect(morphFrame(MORPH_RING_MS).incoming).toBe(0)
    const peak = Math.max(
      ...[0.3, 0.5, 0.6, 0.7].map((f) => morphFrame(MORPH_RING_MS + f * 360).incoming),
    )
    expect(peak).toBeGreaterThan(1)
    expect(morphFrame(MORPH_MS)).toEqual({ ring: 1, outgoing: 0, incoming: 1 })
  })
})

/**
 * Held by reading the source, as the tooltip's are: `packages/ui` renders nothing in its unit tier.
 */
describe('the indicator on both platforms', () => {
  const dir = join(import.meta.dirname, '../src')
  // Only the fade layer differs between them; the indicator around it is one file.
  const halves = ['UpdateFadeLayer.tsx', 'UpdateFadeLayer.native.tsx'].map((name) =>
    readFileSync(join(dir, name), 'utf8'),
  )

  it('fades with the same timing on both', () => {
    for (const half of halves) {
      expect(half).toContain("from './updateIndicatorTiming'")
      expect(half).toContain('UPDATE_FADE_MS')
    }
  })

  it('starts a departing layer drawn, so the old state fades out rather than vanishing', () => {
    const [web, native] = halves
    expect(web).toContain('const shown = leaving ? !entered : entered')
    expect(native).toContain('const from = instant ? (leaving ? 0 : 1) : leaving ? 1 : 0')
  })

  it('drops a departed layer on a timer that a progress update does not clear', () => {
    const hook = readFileSync(join(dir, 'crossfadeLayers.ts'), 'utf8')
    expect(hook).toContain('timers.current.add(timer)')
    expect(hook).not.toMatch(/return \(\) => \{\s*clearTimeout\(timer\)/)
  })
})
