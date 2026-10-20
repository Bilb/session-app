import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readZoom, steppedZoom, writeZoom, ZOOM_LEVELS } from '#src/main/zoom'

describe('stepping the zoom', () => {
  it('moves one level at a time and back to 100%', () => {
    expect(steppedZoom(1, 'in')).toBe(1.1)
    expect(steppedZoom(1.1, 'out')).toBe(1)
    expect(steppedZoom(2, 'reset')).toBe(1)
  })

  it('stops at either end rather than wrapping', () => {
    expect(steppedZoom(ZOOM_LEVELS[0], 'out')).toBe(ZOOM_LEVELS[0])
    expect(steppedZoom(3, 'in')).toBe(3)
  })
})

describe('the saved zoom', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoom-'))

  it('comes back as it was saved', () => {
    const path = join(dir, 'saved.json')
    writeZoom(path, 1.5)
    expect(readZoom(path)).toBe(1.5)
  })

  it('is the default when there is none, it is unreadable, or it is not a level', () => {
    expect(readZoom(join(dir, 'missing.json'))).toBe(1)
    const broken = join(dir, 'broken.json')
    writeFileSync(broken, '{')
    expect(readZoom(broken)).toBe(1)
    const odd = join(dir, 'odd.json')
    writeFileSync(odd, JSON.stringify({ zoom: 1.33 }))
    expect(readZoom(odd)).toBe(1)
  })
})
