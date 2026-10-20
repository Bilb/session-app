import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ALBUM_PICTURE_ID,
  ALBUM_TILE_ID,
  albumTile,
  FETCH_HINT_ID,
  fetchHint,
} from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import { ALBUM_SEAM, albumLayout, cellPlace } from '#src/albumLayout'
import { AttachmentAlbum, type AlbumItem } from '#src/AttachmentAlbum'
import { tileRadius } from '#src/attachmentTileStyle'
import { THEME_STATES } from '#src/themes'

import { byId, declared, nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

const WIDTH = 300

function item(label: string, over: Partial<AlbumItem> = {}): AlbumItem {
  return { label, uri: `file:///${label}`, fetchesOnOpen: false, testID: ALBUM_PICTURE_ID, ...over }
}

function album(
  items: AlbumItem[],
  { onOpen = () => {}, onAccent = false }: { onOpen?: (at: number) => void; onAccent?: boolean },
) {
  return (
    <AttachmentAlbum
      items={items}
      width={WIDTH}
      overflowLabel={(count) => `+${String(count)}`}
      overflowName={(label, count) => `${label} and ${String(count)} more`}
      onOpen={onOpen}
      fetchLabel="Fetch them"
      fetchTestID={FETCH_HINT_ID}
      tileTestID={ALBUM_TILE_ID}
      onAccent={onAccent}
      testID={ELEMENT.conversation.attachment}
    />
  )
}

describe('an album tile', () => {
  it('is a picture while its press does nothing, and a button hinting its press otherwise', () => {
    renderInUI(
      album(
        [item('a.jpg'), item('b.jpg', { hint: 'Open' }), item('c.jpg', { transferring: true })],
        {},
      ),
    )
    expect(nodeOf(ALBUM_TILE_ID, 0)).toMatchObject(albumTile({ name: 'a.jpg' }).desktop!)
    expect(nodeOf(ALBUM_TILE_ID, 1)).toMatchObject(
      albumTile({ name: 'b.jpg', hint: 'Open' }).desktop!,
    )
    expect(nodeOf(ALBUM_TILE_ID, 2)).toMatchObject(
      albumTile({ name: 'c.jpg', transferring: true }).desktop!,
    )
  })

  it('says it is not disabled in every state, rather than dropping the attribute', () => {
    // Android keeps a disabled state whose prop is dropped rather than cleared.
    renderInUI(album([item('a.jpg'), item('b.jpg', { hint: 'Open' })], {}))
    expect(byId(ALBUM_TILE_ID, 0).getAttribute('aria-disabled')).toBe('false')
    expect(byId(ALBUM_TILE_ID, 1).getAttribute('aria-disabled')).toBe('false')
  })

  it('presses on a click, Enter and Space while its press does something', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderInUI(
      album([item('a.jpg', { hint: 'Open' }), item('b.jpg', { hint: 'Open' })], { onOpen }),
    )
    await user.click(byId(ALBUM_TILE_ID, 1))
    byId(ALBUM_TILE_ID, 1).focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onOpen.mock.calls).toEqual([[1], [1], [1]])
  })

  it('takes a click but no key while its press does nothing for the keyboard', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderInUI(album([item('a.jpg'), item('b.jpg')], { onOpen }))
    byId(ALBUM_TILE_ID, 0).focus()
    await user.keyboard('{Enter}')
    expect(onOpen).not.toHaveBeenCalled()
    await user.click(byId(ALBUM_TILE_ID, 0))
    expect(onOpen).toHaveBeenCalledWith(0)
  })

  it('presses nothing while it transfers', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderInUI(album([item('a.jpg', { transferring: true }), item('b.jpg')], { onOpen }))
    await user.click(byId(ALBUM_TILE_ID, 0))
    byId(ALBUM_TILE_ID, 0).focus()
    await user.keyboard('{Enter}')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps focus when the transfer its press started begins and ends', () => {
    const items = (state: Partial<AlbumItem>) => [item('a.jpg', state), item('b.jpg')]
    const { rerender } = renderInUI(album(items({ hint: 'Download' }), {}))
    const tile = byId(ALBUM_TILE_ID, 0)
    tile.focus()
    rerender(album(items({ transferring: true }), {}))
    expect(document.activeElement).toBe(tile)
    rerender(album(items({ hint: 'Open' }), {}))
    expect(document.activeElement).toBe(tile)
  })

  it.each([2, 3])(
    'carries the tile id on each of %i tiles, lead or not, with its picture’s inside it',
    (count) => {
      renderInUI(
        album(
          ['a', 'b', 'c'].slice(0, count).map((name) => item(`${name}.jpg`)),
          {},
        ),
      )
      for (let at = 0; at < count; at += 1) {
        const tile = byId(ALBUM_TILE_ID, at)
        expect(tile.querySelector(`[data-testid="${ALBUM_PICTURE_ID}"]`)).not.toBeNull()
      }
      expect(nodeOf(ALBUM_TILE_ID, count)).toBeNull()
    },
  )

  it('names the tile under the overflow by what the overflow says', () => {
    const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => `${name}.jpg`)
    renderInUI(
      album(
        labels.map((label) => item(label)),
        {},
      ),
    )
    const overflow = albumLayout(labels.length, WIDTH).overflow
    expect(overflow).toBeGreaterThan(0)
    expect(nodeOf(ALBUM_TILE_ID, 4)?.name).toBe(`e.jpg and ${String(overflow)} more`)
    expect(nodeOf(ALBUM_TILE_ID, 3)?.name).toBe('d.jpg')
  })

  describe.each(THEME_STATES)('in %s', (theme) => {
    it.each([
      [false, 'var(--primaryColor)'],
      [true, 'var(--onAccent)'],
    ])('rings every focused tile in the seam, on an accent fill: %s, in %s', (onAccent, colour) => {
      // Three, so the lead tile and the tiles beside it are both drawn.
      const items = ['a', 'b', 'c'].map((name) => item(`${name}.jpg`, { hint: 'Open' }))
      renderInUI(album(items, { onAccent }), theme)
      const layout = albumLayout(items.length, WIDTH)
      for (let at = 0; at < items.length; at += 1) {
        const ring = declared(byId(ALBUM_TILE_ID, at), ':focus-visible')
        expect(ring).toMatchObject({
          'outline-color': colour,
          'outline-offset': '0px',
          'border-top-left-radius': `${String(tileRadius(cellPlace(layout, at)?.side ?? 0))}px`,
        })
        // Wider than the seam, the ring would reach the next tile, which paints over it.
        expect(parseFloat(ring['outline-width'] ?? '')).toBeLessThanOrEqual(ALBUM_SEAM)
      }
    })
  })
})

describe('the album’s download cloud', () => {
  it('is the set’s named control on the desktop, and fetches from the first tile that would', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderInUI(album([item('a.jpg'), item('b.jpg', { fetchesOnOpen: true })], { onOpen }))
    expect(nodeOf(FETCH_HINT_ID)).toMatchObject(fetchHint({ name: 'Fetch them' }).desktop!)
    await user.click(byId(FETCH_HINT_ID))
    expect(onOpen).toHaveBeenCalledWith(1)
  })

  it('is not drawn where nothing would fetch', () => {
    renderInUI(album([item('a.jpg'), item('b.jpg')], {}))
    expect(nodeOf(FETCH_HINT_ID)).toBeNull()
  })
})

describe('the three-up’s cloud', () => {
  const three = [item('a.jpg'), item('b.jpg'), item('c.jpg', { fetchesOnOpen: true })]

  it('takes a press', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    renderInUI(album(three, { onOpen }))
    await user.click(byId(FETCH_HINT_ID))
    expect(onOpen).toHaveBeenCalledWith(2)
  })

  it('sits over the tile that fetches', () => {
    renderInUI(album(three, {}))
    const place = cellPlace(albumLayout(three.length, WIDTH), 2)
    expect(place).toBeDefined()
    // The cloud, then FetchHint's own box, then the box the album places over the tile.
    const box = byId(FETCH_HINT_ID).parentElement?.parentElement
    expect(box === null || box === undefined ? {} : declared(box)).toMatchObject({
      width: `${String(place?.side)}px`,
      height: `${String(place?.side)}px`,
      'margin-top': `${String(place?.top)}px`,
    })
  })
})
