import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What the tile wires on its picture, held by reading the source: `packages/ui` has no renderer
 * to mount it in, and the failure is a tile that sits on its placeholder for ever.
 */
const tile = readFileSync(join(import.meta.dirname, '../src/AttachmentTile.tsx'), 'utf8')

/** The props of the `<Image` whose `uri` is the picture's, up to its closing `/>`. */
function pictureImage(): string {
  const start = tile.indexOf('<Image\n            uri={uri}')
  expect(start).toBeGreaterThanOrEqual(0)
  return tile.slice(start, tile.indexOf('/>', start))
}

describe('an attachment tile’s picture', () => {
  it('reports that it landed', () => {
    expect(pictureImage()).toContain('onLoad=')
  })

  // A thumbnail is made only of a picture that decoded, so one that does not load was evicted
  // under the tile: drawn as failed, a picture that is fine would read as broken.
  it('never wears a failed face: a picture that does not load leaves the placeholder', () => {
    expect(pictureImage()).not.toContain('onError=')
    expect(tile).not.toContain('triangleAlert')
  })
})
