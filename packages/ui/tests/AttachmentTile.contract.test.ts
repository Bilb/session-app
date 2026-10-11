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

  // Without it a three-up album's tiles decode at three quarters of their size on Android.
  it('asks Android for a decode 4/3 its view, so Fresco’s rounding still covers it', () => {
    expect(pictureImage()).toContain('resizeMultiplier={4 / 3}')
  })

  it('is the only picture that does: the placeholder decodes to its view', () => {
    expect(tile.match(/resizeMultiplier=/g)).toHaveLength(1)
  })
})

describe('the image a tile draws with', () => {
  const image = readFileSync(join(import.meta.dirname, '../src/Image.tsx'), 'utf8')

  it('hands the multiplier to react-native, which applies it only under resizeMethod="resize"', () => {
    expect(image).toContain('resizeMethod="resize"')
    expect(image).toContain('resizeMultiplier={resizeMultiplier}')
  })
})
