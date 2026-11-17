import { ALBUM_LONE_MIN_ASPECT, ALBUM_WIDTH } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import {
  ALBUM_MAX_ASPECT,
  ALBUM_MAX_TILES,
  ALBUM_MIN_ROW_HEIGHT_PX,
  ALBUM_SEAM,
  albumLayout,
  lastTile,
  tileAspect,
  type AlbumLayout,
} from '#src/albumLayout'
import {
  HALF,
  IPHONE_SCREEN,
  LANDSCAPE,
  NEEDLE,
  PANORAMA,
  PANORAMA_WIDE,
  PHONE,
  PORTRAIT,
  SQUARE,
  ULTRATALL,
  ULTRAWIDE,
  WIDESCREEN,
} from '#src/catalog/albumShapes'

/** The narrowest album, one in the wide layout, and an odd width that rounds unevenly. */
const WIDTHS = [ALBUM_WIDTH, 420, 301] as const

/** Every mix the rules have to hold for, one to eight pictures, missing dimensions included. */
const SETS: Record<string, readonly (number | undefined)[]> = {
  square: [SQUARE],
  portrait: [PORTRAIT],
  landscape: [LANDSCAPE],
  ultrawide: [ULTRAWIDE],
  ultratall: [ULTRATALL],
  panorama: [PANORAMA],
  half: [HALF],
  missing: [undefined],
  twoSquares: [SQUARE, SQUARE],
  twoPortraits: [PORTRAIT, PORTRAIT],
  twoLandscapes: [LANDSCAPE, LANDSCAPE],
  twoExtremes: [ULTRAWIDE, ULTRATALL],
  threeMixed: [PORTRAIT, LANDSCAPE, SQUARE],
  threeWithMissing: [undefined, LANDSCAPE, PORTRAIT],
  threePanoramas: [PANORAMA, PANORAMA, PANORAMA],
  fourSquares: [SQUARE, SQUARE, SQUARE, SQUARE],
  fourMixed: [PHONE, LANDSCAPE, HALF, PANORAMA],
  fiveMixed: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL],
  fiveUltrawide: [ULTRAWIDE, ULTRAWIDE, ULTRAWIDE, ULTRAWIDE, ULTRAWIDE],
  fiveUltratall: [ULTRATALL, ULTRATALL, ULTRATALL, ULTRATALL, ULTRATALL],
  sixMixed: [SQUARE, PORTRAIT, LANDSCAPE, SQUARE, SQUARE, PHONE],
  sevenWithMissing: [undefined, SQUARE, undefined, LANDSCAPE, PORTRAIT, undefined, SQUARE],
  eightMixed: [PANORAMA, HALF, SQUARE, PORTRAIT, LANDSCAPE, ULTRAWIDE, ULTRATALL, PHONE],
}

const tilesOf = (layout: AlbumLayout) => layout.rows.flatMap((row) => row.tiles)

/** The shortest row at a width: 64 px at the narrowest album, in proportion above it. */
const shortestRowAt = (width: number) => Math.round((ALBUM_MIN_ROW_HEIGHT_PX / ALBUM_WIDTH) * width)

describe.each(WIDTHS)('an album %i px wide', (width) => {
  describe.each(Object.entries(SETS))('of %s', (_, aspects) => {
    const layout = albumLayout(aspects, width)
    const shown = Math.min(aspects.length, ALBUM_MAX_TILES)

    it('fills the width exactly in every row, with no seam left over or overflowing', () => {
      // A lone picture taller than 3:4 is drawn narrower, and the album with it.
      if (shown === 1) expect(layout.width).toBeLessThanOrEqual(width)
      else expect(layout.width).toBe(width)
      for (const row of layout.rows) {
        const widths = row.tiles.reduce((total, tile) => total + tile.width, 0)
        expect(widths + ALBUM_SEAM * (row.tiles.length - 1)).toBe(layout.width)
        let x = 0
        for (const tile of row.tiles) {
          expect(tile.x).toBe(x)
          expect(tile.width).toBeGreaterThan(0)
          x += tile.width + ALBUM_SEAM
        }
      }
    })

    it('is exactly as tall as its rows and the seams between them', () => {
      let y = 0
      for (const row of layout.rows) {
        for (const tile of row.tiles) {
          expect(tile.y).toBe(y)
          expect(tile.height).toBe(row.height)
        }
        y += row.height + ALBUM_SEAM
      }
      expect(layout.height).toBe(y - ALBUM_SEAM)
    })

    it('lands on whole pixels', () => {
      for (const tile of tilesOf(layout))
        for (const value of [tile.x, tile.y, tile.width, tile.height])
          expect(Number.isInteger(value)).toBe(true)
    })

    it('keeps its rows within bounds', () => {
      expect(layout.rows.length).toBeGreaterThanOrEqual(1)
      expect(layout.rows.length).toBeLessThanOrEqual(2)
      const highest = shown === 1 ? Math.round(width / ALBUM_LONE_MIN_ASPECT) : width
      for (const row of layout.rows) {
        expect(row.height).toBeGreaterThanOrEqual(Math.min(shortestRowAt(width), highest))
        expect(row.height).toBeLessThanOrEqual(highest)
      }
    })

    it('draws the first pictures in the sender’s order and counts the rest on the last', () => {
      expect(tilesOf(layout).map((tile) => tile.at)).toEqual(
        Array.from({ length: shown }, (_, at) => at),
      )
      expect(layout.overflow).toBe(aspects.length - shown)
      expect(lastTile(layout)?.at).toBe(shown - 1)
    })
  })
})

describe('a lone picture', () => {
  const lone = (aspect: number | undefined) => albumLayout([aspect], ALBUM_WIDTH)

  it('is as wide as the album at its own shape', () => {
    expect(lone(LANDSCAPE).rows[0]?.tiles[0]).toMatchObject({ width: ALBUM_WIDTH, height: 180 })
    expect(lone(SQUARE).height).toBe(ALBUM_WIDTH)
    expect(lone(PORTRAIT).height).toBe(Math.round(ALBUM_WIDTH / PORTRAIT))
  })

  it('is no taller than a camera’s portrait, a phone screenshot narrower instead of cropped', () => {
    const tallest = Math.round(ALBUM_WIDTH / ALBUM_LONE_MIN_ASPECT)
    expect(lone(PHONE).rows[0]?.tiles[0]).toMatchObject({
      height: tallest,
      width: Math.round(tallest * PHONE),
    })
    expect(lone(ULTRATALL).rows[0]?.tiles[0]).toMatchObject({
      height: tallest,
      width: Math.round(tallest * ULTRATALL),
    })
  })

  it('is cropped only past 9:21', () => {
    const tallest = Math.round(ALBUM_WIDTH / ALBUM_LONE_MIN_ASPECT)
    expect(lone(NEEDLE).rows[0]?.tiles[0]?.width).toBe(Math.round(tallest * ULTRATALL))
  })

  it('stops at 21:9 the other way, where libsession crops its thumbnail', () => {
    const shortest = Math.round(ALBUM_WIDTH / ULTRAWIDE)
    expect(lone(ULTRAWIDE).height).toBe(shortest)
    expect(lone(PANORAMA).height).toBe(shortest)
  })

  it('is a square where nothing said what shape it is', () => {
    for (const aspect of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(lone(aspect).height).toBe(ALBUM_WIDTH)
  })
})

describe('an album of several', () => {
  it('puts two squares side by side', () => {
    const layout = albumLayout([SQUARE, SQUARE], ALBUM_WIDTH)
    expect(layout.rows.map((row) => row.tiles.map((tile) => tile.width))).toEqual([[118, 118]])
  })

  it('gives each tile of a row its picture’s share of the width', () => {
    const [row] = albumLayout([PORTRAIT, LANDSCAPE], ALBUM_WIDTH).rows
    const [narrow, wide] = row?.tiles ?? []
    expect((wide?.width ?? 0) / (narrow?.width ?? 1)).toBeCloseTo(LANDSCAPE / PORTRAIT, 1)
  })

  it('splits into two rows where one would be too short', () => {
    const layout = albumLayout([LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE], ALBUM_WIDTH)
    expect(layout.rows.map((row) => row.tiles.length)).toEqual([2, 2])
  })

  it('crops a row rather than draw it under the shortest, where nothing else fits', () => {
    const layout = albumLayout(Array<number>(5).fill(ULTRAWIDE), ALBUM_WIDTH)
    expect(Math.min(...layout.rows.map((row) => row.height))).toBe(ALBUM_MIN_ROW_HEIGHT_PX)
  })

  it('lays out the same pictures the same way every time', () => {
    const aspects = SETS.eightMixed ?? []
    expect(albumLayout(aspects, ALBUM_WIDTH)).toEqual(albumLayout([...aspects], ALBUM_WIDTH))
  })

  it('draws nothing for no pictures', () => {
    expect(albumLayout([], ALBUM_WIDTH)).toMatchObject({ rows: [], overflow: 0, height: 0 })
  })
})

describe('choosing between layouts', () => {
  const rowSizes = (layout: AlbumLayout) => layout.rows.map((row) => row.tiles.length)
  const area = (tile: { width: number; height: number }) => tile.width * tile.height

  /** Fewer than two other tiles larger than the slot past rounding, as the layout counts it. */
  const slotAmongTwoLargest = (layout: AlbumLayout) => {
    const areas = tilesOf(layout).map(area)
    const slot = areas.pop() ?? 0
    return areas.filter((other) => other > slot * 1.03).length < 2
  }

  it.each([ALBUM_WIDTH, 320, 480])('keeps four portraits a 2×2 grid at %i px', (width) => {
    expect(rowSizes(albumLayout(Array<number>(4).fill(PORTRAIT), width))).toEqual([2, 2])
  })

  it.each([ALBUM_WIDTH, 320, 480])(
    'does not flatten three pictures into a strip at %i px',
    (width) => {
      expect(rowSizes(albumLayout([LANDSCAPE, SQUARE, PORTRAIT], width))).toEqual([1, 2])
      expect(rowSizes(albumLayout([WIDESCREEN, PHONE, PORTRAIT], width))).toEqual([1, 2])
      expect(rowSizes(albumLayout([SQUARE, WIDESCREEN, 4 / 5], width))).toEqual([1, 2])
    },
  )

  it.each([
    [[IPHONE_SCREEN, IPHONE_SCREEN, IPHONE_SCREEN, PORTRAIT, 2 / 3, IPHONE_SCREEN]],
    [[IPHONE_SCREEN, 2 / 3, PHONE, IPHONE_SCREEN, IPHONE_SCREEN, LANDSCAPE]],
    [[PHONE, PHONE, PORTRAIT, IPHONE_SCREEN, PORTRAIT, PORTRAIT, IPHONE_SCREEN, SQUARE, LANDSCAPE]],
  ] as const)(
    'keeps a grid of screenshots and photos a grid at the wide layout’s widest (%#)',
    (aspects) => {
      // Each fits best as two rows half again as tall as wide; one row of five is a third as tall.
      expect(rowSizes(albumLayout(aspects, 480))).toEqual([2, 3])
    },
  )

  it.each([ALBUM_WIDTH, 320, 480])(
    'stacks two landscapes from 1.3:1, and keeps any other pair as nearest the target, at %i px',
    (width) => {
      // A landscape needs the album's whole width to be read; two near-squares stacked would not.
      expect(rowSizes(albumLayout([LANDSCAPE, LANDSCAPE], width))).toEqual([1, 1])
      expect(rowSizes(albumLayout([LANDSCAPE, WIDESCREEN], width))).toEqual([1, 1])
      expect(rowSizes(albumLayout([3 / 2, 3 / 2], width))).toEqual([1, 1])
      expect(rowSizes(albumLayout([5 / 4, 5 / 4], width))).toEqual([2])
      expect(rowSizes(albumLayout([1.04, 1.04], width))).toEqual([2])
      expect(rowSizes(albumLayout([SQUARE, SQUARE], width))).toEqual([2])
      expect(rowSizes(albumLayout([PORTRAIT, PORTRAIT], width))).toEqual([2])
      expect(rowSizes(albumLayout([PORTRAIT, LANDSCAPE], width))).toEqual([2])
      expect(rowSizes(albumLayout([SQUARE, LANDSCAPE], width))).toEqual([2])
    },
  )

  it.each([ALBUM_WIDTH, 320, 480])(
    'keeps "+N" out of the two largest tiles where another split can, at %i px',
    (width) => {
      for (const aspects of [
        [PORTRAIT, PORTRAIT, PORTRAIT, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE],
        [LANDSCAPE, LANDSCAPE, PORTRAIT, LANDSCAPE, LANDSCAPE, PORTRAIT, PORTRAIT],
      ]) {
        const layout = albumLayout(aspects, width)
        expect(layout.overflow).toBeGreaterThan(0)
        expect(slotAmongTwoLargest(layout)).toBe(false)
      }
    },
  )

  it.each([
    [320, [IPHONE_SCREEN, PORTRAIT, LANDSCAPE, LANDSCAPE]],
    [320, [PORTRAIT, PHONE, WIDESCREEN, WIDESCREEN]],
    [480, [WIDESCREEN, PORTRAIT, LANDSCAPE, LANDSCAPE]],
    [480, [WIDESCREEN, PORTRAIT, PORTRAIT, WIDESCREEN]],
  ] as const)(
    'balances a lopsided set rather than draw one tile over a row of small ones, at %i px',
    (width, aspects) => {
      const layout = albumLayout(aspects, width)
      expect(rowSizes(layout)).toEqual([2, 2])
      const areas = tilesOf(layout).map(area)
      expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(4)
    },
  )

  it.each([
    [ALBUM_WIDTH, [IPHONE_SCREEN, LANDSCAPE, WIDESCREEN, PORTRAIT, LANDSCAPE]],
    [320, [IPHONE_SCREEN, LANDSCAPE, WIDESCREEN, PORTRAIT, LANDSCAPE]],
    [320, [IPHONE_SCREEN, LANDSCAPE, LANDSCAPE, 3 / 2, LANDSCAPE]],
    [ALBUM_WIDTH, [LANDSCAPE, PORTRAIT, LANDSCAPE, LANDSCAPE, LANDSCAPE]],
  ] as const)(
    'crops no more than the layout nearest the target height, at %i px',
    (width, aspects) => {
      // Each fits uncropped nearest the target; a split with fewer slivers would crop a row.
      const layout = albumLayout(aspects, width)
      for (const row of layout.rows) {
        const shapes = row.tiles.map((tile) => tileAspect(aspects[tile.at]))
        const sum = shapes.reduce((total, shape) => total + shape, 0)
        const filling = (width - ALBUM_SEAM * (shapes.length - 1)) / sum
        expect(Math.abs(row.height - filling)).toBeLessThanOrEqual(0.5)
      }
    },
  )

  it('gives a strip of screenshots room rather than draw slivers, at the narrowest album', () => {
    const layout = albumLayout(
      [IPHONE_SCREEN, PORTRAIT, PORTRAIT, IPHONE_SCREEN, IPHONE_SCREEN],
      ALBUM_WIDTH,
    )
    expect(rowSizes(layout)).toEqual([2, 3])
    expect(Math.min(...tilesOf(layout).map((tile) => tile.width))).toBeGreaterThanOrEqual(56)
  })

  it('does not grow an album past 1.5 times its width to widen its tiles', () => {
    // One row of four is narrow here, but the 2×2 it could become is 1.6 times as tall as wide.
    const layout = albumLayout([IPHONE_SCREEN, PORTRAIT, PORTRAIT, IPHONE_SCREEN], ALBUM_WIDTH)
    expect(layout.height).toBeLessThanOrEqual(1.5 * ALBUM_WIDTH)
  })
})

describe('a tile’s shape', () => {
  it('is the picture’s within the limits, and a square where it is unknown', () => {
    expect(tileAspect(LANDSCAPE)).toBe(LANDSCAPE)
    expect(tileAspect(PANORAMA)).toBe(ALBUM_MAX_ASPECT)
    expect(tileAspect(ULTRATALL)).toBe(1 / ALBUM_MAX_ASPECT)
    expect(tileAspect(undefined)).toBe(1)
  })
})

describe('an album at the wide layout’s widest', () => {
  const WIDEST = 340
  const CAP = 340

  it('draws a lone picture no taller than the cap, narrower rather than cropped', () => {
    const [portrait] =
      albumLayout([PORTRAIT], WIDEST, { loneMaxHeightPx: CAP }).rows[0]?.tiles ?? []
    expect(portrait).toMatchObject({ height: CAP, width: Math.round(CAP * PORTRAIT) })
    const [phone] = albumLayout([PHONE], WIDEST, { loneMaxHeightPx: CAP }).rows[0]?.tiles ?? []
    expect(phone).toMatchObject({ height: CAP, width: Math.round(CAP * PHONE) })
  })

  it('leaves a lone picture under the cap as it is', () => {
    expect(albumLayout([LANDSCAPE], WIDEST, { loneMaxHeightPx: CAP }).rows[0]?.tiles[0]).toEqual(
      albumLayout([LANDSCAPE], WIDEST).rows[0]?.tiles[0],
    )
  })

  it('scales the shortest row with the width', () => {
    const layout = albumLayout(Array<number>(5).fill(ULTRAWIDE), WIDEST)
    expect(Math.min(...layout.rows.map((row) => row.height))).toBe(shortestRowAt(WIDEST))
  })
})

describe('the tile under "+N"', () => {
  const SHAPES = [NEEDLE, 1 / 3, ULTRATALL, HALF, PHONE, PORTRAIT, SQUARE, LANDSCAPE, 3 / 2]
  const MORE = [WIDESCREEN, ULTRAWIDE, PANORAMA, PANORAMA_WIDE]
  const ALL = [...SHAPES, ...MORE]

  /** Every set a seeded generator gives, so a failure names a set that can be replayed. */
  function* sets(count: number): Generator<number[]> {
    let seed = 7
    const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648
    for (let n = 0; n < count; n++) {
      const length = 6 + Math.floor(next() * 5)
      yield Array.from({ length }, () => ALL[Math.floor(next() * ALL.length)] ?? 1)
    }
  }

  it('is never the largest tile or tied for it, nor alone on its row', () => {
    for (const aspects of sets(2000))
      for (const width of [ALBUM_WIDTH, 320, 420, 480]) {
        const layout = albumLayout(aspects, width)
        const tiles = tilesOf(layout)
        const area = (tile: { width: number; height: number }) => tile.width * tile.height
        const counted = area(tiles[tiles.length - 1] ?? { width: 0, height: 0 })
        expect(layout.rows.at(-1)?.tiles.length ?? 0).toBeGreaterThan(1)
        const others = tiles.slice(0, -1).map(area)
        // Smaller than the largest other, beyond rounding; or every tile alike.
        expect(
          others.some((other) => other > counted * 1.03) ||
            others.every((other) => Math.abs(other - counted) <= counted * 0.03),
          `${String(width)} px: ${aspects.join(', ')}`,
        ).toBe(true)
      }
  })

  it.each([
    ['needles', [NEEDLE, NEEDLE, NEEDLE, NEEDLE, PANORAMA_WIDE, LANDSCAPE, LANDSCAPE]],
    ['panoramas', Array<number>(7).fill(PANORAMA)],
    ['phones', Array<number>(7).fill(IPHONE_SCREEN)],
    ['a row of small ones over a square', [PHONE, PORTRAIT, PHONE, SQUARE, PORTRAIT, SQUARE]],
    ['wide pictures first', [5, LANDSCAPE, ULTRATALL, SQUARE, ULTRAWIDE, SQUARE, SQUARE]],
  ] as const)('never has a row to itself, %s', (_, aspects) => {
    for (const width of [ALBUM_WIDTH, 320, 420, 520]) {
      const layout = albumLayout(aspects, width)
      expect(layout.overflow).toBeGreaterThan(0)
      expect(layout.rows.at(-1)?.tiles.length ?? 0).toBeGreaterThan(1)
    }
  })

  it('is a square among ordinary pictures', () => {
    const layout = albumLayout(Array<number>(7).fill(LANDSCAPE), ALBUM_WIDTH)
    const slot = lastTile(layout)
    expect(Math.abs((slot?.width ?? 0) - (slot?.height ?? 0))).toBeLessThanOrEqual(2)
  })

  it('stays the last one, so the count follows the pictures it counts', () => {
    const layout = albumLayout(
      [...Array<number>(4).fill(NEEDLE), PANORAMA_WIDE, LANDSCAPE, LANDSCAPE],
      280,
    )
    expect(lastTile(layout)?.at).toBe(ALBUM_MAX_TILES - 1)
  })

  it('is as narrow as the pictures beside it when they are all narrow, rather than cropping one', () => {
    const layout = albumLayout(Array<number>(7).fill(IPHONE_SCREEN), ALBUM_WIDTH)
    const widths = layout.rows.at(-1)?.tiles.map((tile) => tile.width) ?? []
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  })

  it('is not the largest of seven panoramas', () => {
    const layout = albumLayout(Array<number>(7).fill(PANORAMA), ALBUM_WIDTH)
    const last = lastTile(layout)
    const others = tilesOf(layout).slice(0, -1)
    expect(
      others.some((tile) => tile.width * tile.height >= (last?.width ?? 0) * (last?.height ?? 0)),
    ).toBe(true)
  })
})
