import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { tr } from '@session/localization'
import { describe, expect, it } from 'vitest'

import { albumTileName } from '#src/albumTileName'
import { PENDING_COPY } from '#src/pendingCopy'

describe('what a screen reader calls a picture in an album', () => {
  it('is its filename where it has one', () => {
    expect(albumTileName('harbour.jpg', 0, 2)).toBe('harbour.jpg')
  })

  it('is its place among the album’s pictures otherwise, counted from 1', () => {
    expect(albumTileName(undefined, 0, 7)).toBe('Image 1 of 7')
    expect(albumTileName(undefined, 6, 7)).toBe(PENDING_COPY.attachmentImagePosition(7, 7))
  })
})

/** The wiring, read from the source because nothing in the unit tier renders an album. */
describe('an album', () => {
  const album = readFileSync(join(import.meta.dirname, '../src/MessageAlbum.tsx'), 'utf8')

  it('names each tile by its picture, counted over every picture the album stands for', () => {
    expect(album).toContain('label: albumTileName(attachment.filename, at, viewable.length)')
  })

  it('hints what a tap on the tile does in its own state, in the row’s words', () => {
    // Open once here, Download or Retry before; nothing while fetching or gone, as a row.
    expect(album).toContain('const verb = rowVerb(state, true)')
    expect(album).toContain('hint: verb === null ? undefined : verbLabel(verb)')
  })

  it('names the tile under "+N" by the overflow too, with the catalogue’s own wording of it', () => {
    expect(album).toContain(
      "overflowName={(label, count) => `${label}, ${tr('andMore', { count })}`}",
    )
    expect(tr('andMore', { count: 3 })).toBe('+3')
  })

  it('recomputes the names when the language changes, which the memo would otherwise hold', () => {
    expect(album).toContain('const locale = useLocale()')
    expect(album).toMatch(/\}, \[viewable, message\.id, statesKey, locale\]\)/)
  })

  it('keeps the test id on the picture', () => {
    expect(album).toContain('testID: ELEMENT.conversation.attachmentImage')
  })
})
