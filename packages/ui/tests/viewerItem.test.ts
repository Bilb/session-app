import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { drawnUri } from '#src/viewerItem'

describe('what the viewer draws of an item', () => {
  const item = { uri: 'rendition://7/2', fallbackUri: 'media://7/2' }

  it('is its url until that fails, then the file behind it', () => {
    expect(drawnUri(item, [])).toBe('rendition://7/2')
    expect(drawnUri(item, ['rendition://7/2'])).toBe('media://7/2')
  })

  it('is nothing once both failed, or where there is no url at all', () => {
    expect(drawnUri(item, ['rendition://7/2', 'media://7/2'])).toBeNull()
    expect(drawnUri({ uri: 'rendition://7/2' }, ['rendition://7/2'])).toBeNull()
    expect(drawnUri({ uri: null }, [])).toBeNull()
  })
})

describe('the viewer', () => {
  const viewer = readFileSync(join(import.meta.dirname, '../src/MediaViewer.tsx'), 'utf8')

  it('draws the first of the item’s urls that has not failed, and records one that fails', () => {
    expect(viewer).toContain('drawnUri(current, failedUris)')
    expect(viewer).toContain('uri={drawn}')
    expect(viewer).toContain('setFailedUris((was) => [...was, drawn])')
  })
})
