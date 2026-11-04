import { describe, expect, it } from 'vitest'

import {
  classifyPages,
  containedSize,
  countByStatus,
  decodePng,
  diffPictures,
  encodePng,
  hasDifferences,
  isBlank,
  pngSize,
  type PageDiff,
  type Picture,
} from '#catalog/diff'

type Rgba = readonly [number, number, number, number]

const WHITE: Rgba = [255, 255, 255, 255]
const BLACK: Rgba = [0, 0, 0, 255]

/** A `width` by `height` picture of `fill`, with `paint` drawing over it pixel by pixel. */
function picture(
  width: number,
  height: number,
  fill: Rgba = WHITE,
  paint: (x: number, y: number) => Rgba | undefined = () => undefined,
): Picture {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(paint(x, y) ?? fill, (y * width + x) * 4)
  return { width, height, data }
}

/** A solid block, the kind of change a moved or recoloured element makes. */
const block =
  (left: number, top: number, size: number, colour: Rgba) =>
  (x: number, y: number): Rgba | undefined =>
    x >= left && x < left + size && y >= top && y < top + size ? colour : undefined

describe('diffing two pictures of a page', () => {
  it('finds nothing in identical pictures', () => {
    const diff = diffPictures(picture(100, 100), picture(100, 100))
    expect(diff).toMatchObject({ status: 'unchanged', differingPixels: 0, totalPixels: 10_000 })
    expect(diff.highlight).toBeUndefined()
  })

  it('counts a changed block and highlights it', () => {
    const diff = diffPictures(picture(100, 100), picture(100, 100, WHITE, block(10, 10, 10, BLACK)))
    expect(diff.status).toBe('changed')
    expect(diff.differingPixels).toBe(100)
    expect(diff.highlight).toMatchObject({ width: 100, height: 100 })
    const at = (15 * 100 + 15) * 4
    expect([...(diff.highlight?.data.subarray(at, at + 4) ?? [])]).toEqual([255, 0, 0, 255])
  })

  it('ignores fewer differing pixels than the tolerant pass needs, as Argos does', () => {
    // On a page of 250 000 pixels the floor is 20, the smaller of 20 and 0.02% of it.
    const diff = diffPictures(picture(500, 500), picture(500, 500, WHITE, block(50, 50, 4, BLACK)))
    expect(diff.status).toBe('unchanged')
  })

  it('counts any differing pixel at sensitivity 0', () => {
    const diff = diffPictures(
      picture(500, 500),
      picture(500, 500, WHITE, block(50, 50, 4, BLACK)),
      0,
    )
    expect(diff).toMatchObject({ status: 'changed', differingPixels: 16 })
  })

  it('catches a faint change of colour over a large area in the colour-sensitive pass', () => {
    // Too faint for the tolerant pass, and over far more than 3% of the page.
    const faint: Rgba = [244, 244, 244, 255]
    const diff = diffPictures(picture(100, 100), picture(100, 100, faint))
    expect(diff).toMatchObject({ status: 'changed', differingPixels: 10_000 })
  })

  it('leaves a faint change over a small area alone', () => {
    const faint: Rgba = [244, 244, 244, 255]
    const diff = diffPictures(picture(100, 100), picture(100, 100, WHITE, block(0, 0, 10, faint)))
    expect(diff.status).toBe('unchanged')
  })

  it('draws the unchanged pixels of the after picture, faded, beneath what differs', () => {
    const grey: Rgba = [100, 100, 100, 255]
    const lighter: Rgba = [130, 130, 130, 255]
    // The lighter patch is under both passes' tolerance, so it is drawn faded rather than red.
    const diff = diffPictures(
      picture(100, 100, grey, block(60, 60, 10, BLACK)),
      picture(100, 100, grey, block(10, 10, 10, lighter)),
    )
    expect(diff).toMatchObject({ status: 'changed', differingPixels: 100 })
    const at = (15 * 100 + 15) * 4
    // pixelmatch fades to a tenth: 255 + (130 - 255) * 0.1 from after, where before gives 239.
    expect([...(diff.highlight?.data.subarray(at, at + 4) ?? [])]).toEqual([242, 242, 242, 255])
  })
})

describe('pages that changed size, as Argos compares them', () => {
  const NAVY: Rgba = [20, 30, 80, 255]

  it('decides nothing from the size alone: what the larger adds counts only if not white', () => {
    // odiff takes the transparent padding as white, so a white strip below matches it.
    expect(diffPictures(picture(100, 100), picture(100, 120))).toMatchObject({
      status: 'unchanged',
      differingPixels: 0,
      totalPixels: 12_000,
      before: { width: 100, height: 100 },
      after: { width: 100, height: 120 },
    })
    const darker = diffPictures(picture(100, 100, NAVY), picture(100, 120, NAVY))
    expect(darker).toMatchObject({ status: 'changed', differingPixels: 2_000, totalPixels: 12_000 })
    expect(darker.scaled).toBeUndefined()
  })

  it('enlarges a picture smaller in both dimensions to fit, keeping its aspect ratio', () => {
    // 50x40 into 100x100: the width fills first, so it is drawn at 100x80 with 20 rows below.
    const diff = diffPictures(picture(50, 40, NAVY), picture(100, 100, NAVY))
    expect(diff.scaled).toEqual({ side: 'before', to: { width: 100, height: 80 } })
    expect(diff).toMatchObject({ status: 'changed', differingPixels: 2_000, totalPixels: 10_000 })
  })

  it('finds no change in a picture that only grew, once the smaller is enlarged', () => {
    // A solid page enlarges exactly. A page with sharp edges does not: the kernel softens each
    // edge over a few pixels, which counts, as it would in Argos.
    const diff = diffPictures(picture(40, 30, NAVY), picture(80, 60, NAVY))
    expect(diff.scaled).toEqual({ side: 'before', to: { width: 80, height: 60 } })
    expect(diff).toMatchObject({ status: 'unchanged', differingPixels: 0, totalPixels: 4_800 })
  })

  it('leaves alone the corner neither covers when one is wider and the other taller', () => {
    // 120x100 against 100x120: neither is smaller in both, so neither is scaled. The 20x20 corner
    // is transparent on both sides and matches; each 20x100 strip one side alone covers is navy
    // against transparency, so counts.
    const diff = diffPictures(picture(120, 100, NAVY), picture(100, 120, NAVY))
    expect(diff.scaled).toBeUndefined()
    expect(diff).toMatchObject({ status: 'changed', differingPixels: 4_000, totalPixels: 14_400 })
    const corner = (110 * 120 + 110) * 4
    expect(diff.highlight?.data[corner + 3]).toBe(0)
  })

  it('compares same-size pictures as they are', () => {
    const diff = diffPictures(picture(100, 100, NAVY), picture(100, 100, NAVY))
    expect(diff).toMatchObject({ status: 'unchanged', totalPixels: 10_000 })
    expect(diff.scaled).toBeUndefined()
  })
})

describe('the size sharp contains a picture in', () => {
  it('fills the side nearer filling the canvas and rounds the other', () => {
    // The capture this was found on: 1640x722 against 1720x760.
    expect(containedSize({ width: 1640, height: 722 }, { width: 1720, height: 760 })).toEqual({
      width: 1720,
      height: 757,
    })
  })

  it('leaves a picture as it is unless it is smaller in both dimensions', () => {
    expect(containedSize({ width: 100, height: 50 }, { width: 100, height: 80 })).toEqual({
      width: 100,
      height: 50,
    })
  })
})

describe('PNG files', () => {
  it('come back as they were written, and tell their size from the header', () => {
    const drawn = picture(7, 3, BLACK, block(1, 1, 1, WHITE))
    const bytes = encodePng(drawn)
    expect(pngSize(bytes)).toEqual({ width: 7, height: 3 })
    expect(decodePng(bytes)).toEqual(drawn)
  })

  it('are blank when every pixel is the colour of the first', () => {
    expect(isBlank(picture(10, 10, BLACK))).toBe(true)
    expect(isBlank(picture(10, 10, BLACK, block(9, 9, 1, WHITE)))).toBe(false)
  })
})

describe('classifying the pages', () => {
  const verdicts: Record<string, PageDiff['status']> = { same: 'unchanged', moved: 'changed' }
  const diffOf = (id: string): PageDiff => ({
    status: verdicts[id] ?? 'unchanged',
    differingPixels: verdicts[id] === 'changed' ? 5 : 0,
    totalPixels: 100,
    before: { width: 10, height: 10 },
    after: { width: 10, height: 10 },
  })

  it('lists what changed, then what was added, then removed, then the rest', () => {
    const results = classifyPages(['same', 'moved', 'gone'], ['new', 'same', 'moved'], diffOf)
    expect(results.map(({ id, status }) => [id, status])).toEqual([
      ['moved', 'changed'],
      ['new', 'added'],
      ['gone', 'removed'],
      ['same', 'unchanged'],
    ])
    expect(countByStatus(results)).toEqual({ changed: 1, added: 1, removed: 1, unchanged: 1 })
    expect(hasDifferences(results)).toBe(true)
  })

  it('diffs only the pages both sides drew', () => {
    const asked: string[] = []
    classifyPages(['same', 'gone'], ['same', 'new'], (id) => {
      asked.push(id)
      return diffOf(id)
    })
    expect(asked).toEqual(['same'])
  })

  it('finds no differences when every page is unchanged', () => {
    expect(hasDifferences(classifyPages(['same'], ['same'], diffOf))).toBe(false)
  })
})
