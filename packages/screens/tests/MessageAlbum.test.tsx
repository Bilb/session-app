import { act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { memoryPorts, resetPorts, setPorts } from '@session/app'
import type { Attachment, Message } from '@session/client'
import {
  ALBUM_PICTURE_ID,
  ALBUM_TILE_ID,
  albumTile,
  FETCH_HINT_ID,
  fetchHint,
  pictureVerb,
  setFetchName,
  verbName,
} from '@session/expectations'
import { resetLocale, setLocale, tr } from '@session/localization'
import { byId, nodeOf } from '@session/render-tier'
import { ALBUM_MAX_TILES } from '@session/ui'

import type { FetchState } from '#src/attachmentFetch'
import type { AttachmentSetState } from '#src/attachmentSet'
import { MessageAlbum } from '#src/MessageAlbum'
import { PENDING_COPY } from '#src/pendingCopy'

import { renderScreen } from './support/render'

function picture(index: number, filename?: string): Attachment {
  return {
    index,
    contentType: 'image/jpeg',
    ...(filename === undefined ? {} : { filename }),
    voiceMessage: false,
    hasThumbhash: false,
    hasThumbnail: false,
    uploaded: true,
    availability: 'absent',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
  }
}

function message(attachments: Attachment[]): Message {
  return { id: 7, attachments } as unknown as Message
}

function album(
  shown: Message,
  states: FetchState[],
  {
    onOpen = () => {},
    setState = 'idle',
  }: { onOpen?: (index: number) => void; setState?: AttachmentSetState } = {},
) {
  return (
    <MessageAlbum
      message={shown}
      onOpen={onOpen}
      fetchFor={(attachment) => ({
        state: states[attachment.index] ?? 'idle',
        doneBytes: 0,
        totalBytes: 0,
      })}
      setState={setState}
      onAccent={false}
    />
  )
}

afterEach(() => {
  act(() => {
    resetLocale()
  })
  resetPorts()
})

describe('an album’s tiles', () => {
  it('are named by their picture and hint what a press does in each one’s own state', () => {
    const states: FetchState[] = ['idle', 'fetching', 'ready', 'failed', 'unavailable']
    const shown = message(states.map((_, at) => picture(at, `p${String(at)}.jpg`)))
    renderScreen(album(shown, states))
    states.forEach((state, at) => {
      const verb = pictureVerb(state)
      expect(nodeOf(ALBUM_TILE_ID, at)).toMatchObject(
        albumTile({
          name: `p${String(at)}.jpg`,
          hint: verb === null ? undefined : verbName(verb),
          transferring: state === 'fetching',
        }).desktop!,
      )
    })
  })

  it('are named by their place among every picture the album stands for, where unnamed', () => {
    const shown = message([picture(0), picture(1, 'harbour.jpg'), picture(2)])
    renderScreen(album(shown, []))
    expect(nodeOf(ALBUM_TILE_ID, 0)?.name).toBe(PENDING_COPY.attachmentImagePosition(1, 3))
    expect(nodeOf(ALBUM_TILE_ID, 2)?.name).toBe(PENDING_COPY.attachmentImagePosition(3, 3))
  })

  it('name the tile under "+N" by the overflow too', () => {
    const count = ALBUM_MAX_TILES + 3
    const shown = message(
      Array.from({ length: count }, (_, at) => picture(at, `p${String(at)}.jpg`)),
    )
    renderScreen(album(shown, []))
    const last = ALBUM_MAX_TILES - 1
    expect(nodeOf(ALBUM_TILE_ID, last)?.name).toBe(
      PENDING_COPY.attachmentNameAndMore(`p${String(last)}.jpg`, count - ALBUM_MAX_TILES),
    )
  })

  it('are hinted again in the new language when it changes', () => {
    renderScreen(album(message([picture(0, 'a.jpg'), picture(1, 'b.jpg')]), []))
    act(() => {
      setLocale('fr')
    })
    expect(tr('download')).not.toBe('Download')
    expect(nodeOf(ALBUM_TILE_ID, 0)?.hint).toBe(tr('download'))
  })

  it('open the attachment at their place in the message, from the latest callback', async () => {
    const user = userEvent.setup()
    const first = vi.fn()
    const latest = vi.fn()
    const shown = message([picture(0, 'a.jpg'), picture(1, 'b.jpg')])
    const { rerender } = renderScreen(album(shown, ['ready', 'ready'], { onOpen: first }))
    rerender(album(shown, ['ready', 'ready'], { onOpen: latest }))
    await user.click(byId(ALBUM_TILE_ID, 1))
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith(1)
  })

  it('carry the tile id, with the picture id on the picture inside', () => {
    setPorts(
      memoryPorts({
        media: {
          urlFor: () => null,
          thumbhashUrlFor: () => null,
          thumbnailUrlFor: ({ index }) => `file:///thumbnail-${String(index)}.jpg`,
        },
      }),
    )
    const thumbnailed = (index: number) => ({ ...picture(index, 'a.jpg'), hasThumbnail: true })
    renderScreen(album(message([thumbnailed(0), thumbnailed(1)]), ['ready', 'ready']))
    for (const at of [0, 1]) {
      const tile = byId(ALBUM_TILE_ID, at)
      expect(tile.querySelector(`[data-testid="${ALBUM_PICTURE_ID}"]`)).not.toBeNull()
    }
  })
})

describe('an album’s cloud', () => {
  it.each<AttachmentSetState>(['idle', 'failed'])(
    'says the set’s verb while the set is %s',
    (setState) => {
      const shown = message([picture(0, 'a.jpg'), picture(1, 'b.jpg')])
      renderScreen(album(shown, [setState === 'failed' ? 'failed' : 'idle', 'idle'], { setState }))
      expect(nodeOf(FETCH_HINT_ID)).toMatchObject(
        fetchHint({ name: setFetchName(setState === 'failed') }).desktop!,
      )
    },
  )
})
