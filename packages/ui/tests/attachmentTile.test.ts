import { RADII } from '@session/theme-tokens'
import { describe, expect, it } from 'vitest'

import { TILE_RADIUS_STEP, tileRadius } from '#src/attachmentTile'

describe('a tile’s corner', () => {
  it('takes the larger radius at the sizes an album draws', () => {
    // The five-up's quarters are about 100 at a desktop bubble's width and about 70 on a phone,
    // and the three-up's small tiles the same. All of them are the larger corner.
    expect(tileRadius(208)).toBe(RADII.md)
    expect(tileRadius(102)).toBe(RADII.md)
    expect(tileRadius(70)).toBe(RADII.md)
  })

  it('takes the smaller radius at the size a list draws', () => {
    // 12 on a 40 px square is most of its half-width, which reads as a squircle rather than as the
    // same tile drawn smaller.
    expect(tileRadius(40)).toBe(RADII.sm)
  })

  it('steps once, and at the boundary it names', () => {
    expect(tileRadius(TILE_RADIUS_STEP)).toBe(RADII.md)
    expect(tileRadius(TILE_RADIUS_STEP - 1)).toBe(RADII.sm)
    // Two steps and no more: three would stop the album's tiles and the list's thumbnails reading
    // as the same family, which is the whole reason there is one component.
    expect(new Set([tileRadius(1), tileRadius(40), tileRadius(64), tileRadius(400)]).size).toBe(2)
  })
})
