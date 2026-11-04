import { memo, type ReactNode } from 'react'
import { isWeb, XStack, YStack } from 'tamagui'

import type { WithFetchesOnOpen, WithMediaThumbhash, WithMediaUri } from '@session/basic-types'
import type { ElementId } from '@session/test-ids'

import { ALBUM_SEAM, albumLayout, lastTile } from './albumLayout'
import { AttachmentTile } from './AttachmentTile'
import { FetchHint } from './FetchHint'
import { tileRadius } from './attachmentTileStyle'
import { useForcedFocus } from './interactionOverride'
import { focusRing, heldButton, keyboardPress } from './keyboardPress'
import { pressHint } from './pressHint'
import { StateLayer } from './StateLayer'
import type { WithTestID } from './with'

export type AlbumItem = WithMediaUri &
  WithMediaThumbhash &
  WithFetchesOnOpen &
  WithTestID & {
    /** Already worded: what a screen reader announces the tile as. */
    label: string
    /**
     * The picture's shape, width over height, as known before its bytes are: what the tile is laid
     * out at. Absent where nothing says, which draws a square.
     */
    aspect?: number | undefined
    /**
     * Already worded: what a press on the tile does, said after its name. Absent while the press
     * does nothing for this tile, which also takes it out of the tab order and announces it as a
     * picture rather than a button.
     */
    hint?: string | undefined
    /**
     * A transfer is running for it. The tile stays a button, disabled and still a tab stop, so
     * focus on the tile whose press started the transfer stays put.
     */
    transferring?: boolean | undefined
  }

export type AttachmentAlbumProps = WithTestID & {
  items: readonly AlbumItem[]
  /** The message's own width. Never a constant: an album is as wide as the bubble it sits in. */
  width: number
  /** Already worded, because `@session/ui` cannot reach the catalogue. */
  overflowLabel: (count: number) => string
  /**
   * Already worded: what the tile drawn under the overflow is announced as, from its own label.
   * The overflow covers its picture, so its name has to say what the overflow says.
   */
  overflowName: (label: string, count: number) => string
  onOpen: (at: number) => void
  /**
   * The set's own badge, drawn in the album's corner.
   *
   * The corner rather than the middle of a tile: a badge on a tile reads as that tile's state,
   * and this one is about the whole message, including the attachments behind "+N".
   */
  control?: ReactNode | undefined
  /** Already worded; what the cloud that fetches the set is announced as. */
  fetchLabel: string
  fetchTestID: ElementId
  /** On every tile, which is what a test taps; an item's own `testID` is its picture's. */
  tileTestID: ElementId
  /** How tall a picture sent alone may be drawn: its layout's cap. */
  loneMaxHeightPx?: number | undefined
  /**
   * Drawn on an accent fill, a bubble you sent. Only the focus ring reads it: the ring falls in the
   * seams and round the edge, on the fill, where the accent would not show.
   */
  onAccent?: boolean | undefined
}

/**
 * The rect arrives as `at`, `width` and `height` rather than as itself: `albumLayout` builds new
 * rects on every render, and `memo` would see each one as a change.
 */
const AlbumTile = memo(function AlbumTile({
  item,
  at,
  width,
  height,
  overflowLabel,
  name,
  onOpen,
  onAccent,
  testID,
}: WithTestID & {
  /** Absent only where the layout and the items disagree, which draws nothing. */
  item: AlbumItem | undefined
  at: number
  width: number
  height: number
  /** Only on the tile that carries the overflow. */
  overflowLabel?: string | undefined
  /** What the tile is announced as, which is the item's label but on the overflow's tile. */
  name: string
  onOpen: (at: number) => void
  onAccent: boolean
}) {
  const forcedFocus = useForcedFocus()
  if (item === undefined) return null
  // A tile that would fetch is the whole set's, so it dims with the album, and at rest on touch
  // under the album's cloud. One that is here opens its own picture, so it answers on its own.
  const fetches = item.fetchesOnOpen === true
  const held = item.transferring === true
  const press = () => {
    onOpen(at)
  }
  // Inside the seam rather than over the tile, whose own layers would paint over the ring.
  const radius = tileRadius(Math.min(width, height))
  const ring = focusRing({ onAccent, offset: 0, radius })
  return (
    <YStack
      {...(held
        ? heldButton(name, ring)
        : {
            role: item.hint === undefined ? ('img' as const) : ('button' as const),
            'aria-label': name,
          })}
      {...pressHint(item.hint)}
      {...keyboardPress(held || item.hint === undefined ? undefined : press, ring)}
      {...forcedFocus}
      aria-disabled={held}
      // tamagui makes a native view an accessibility element only for this. On iOS that hides
      // what is nested, the picture's test id included, so the tile carries its own.
      {...(isWeb ? {} : { tabIndex: 0 })}
      testID={testID}
      position="relative"
      $platform-web={{ cursor: 'pointer' }}
      onPress={held ? undefined : press}
      // A group in every state: tamagui remounts a view that gains or drops one, dropping focus.
      group="tile"
    >
      <AttachmentTile
        width={width}
        height={height}
        uri={item.uri}
        thumbhash={item.thumbhash}
        overflowLabel={overflowLabel}
        testID={item.testID}
      />
      <StateLayer
        group={fetches ? 'album' : 'tile'}
        tone="scrim"
        borderRadius={radius}
        atRest={fetches && !isWeb}
      />
    </YStack>
  )
})

/**
 * Every picture on one message, as one object.
 *
 * The geometry is `albumLayout`'s, from the shapes the items carry, so this places and never
 * measures. The set's own control is handed in rather than built here: what it says is a fact about
 * the message's transfers, which this package knows nothing about, and where it sits is a fact
 * about the shape, which the layout already answered.
 */
export function AttachmentAlbum({
  items,
  width,
  overflowLabel,
  overflowName,
  onOpen,
  control,
  fetchLabel,
  fetchTestID,
  tileTestID,
  onAccent = false,
  loneMaxHeightPx,
  testID,
}: AttachmentAlbumProps) {
  const layout = albumLayout(
    items.map((item) => item.aspect),
    width,
    { loneMaxHeightPx },
  )
  const overflowAt = layout.overflow > 0 ? lastTile(layout)?.at : undefined
  // The pictures the album hides past its tiles: a reader takes the slot's own picture as shown.
  const overflowText = overflowAt === undefined ? undefined : overflowLabel(layout.overflow)
  const nameOf = (at: number) => {
    const label = items[at]?.label ?? ''
    return at === overflowAt ? overflowName(label, layout.overflow) : label
  }
  // One cloud for the message: a press on any tile fetches the whole set, so no tile is its own.
  // Centred on the album, where it may sit over a seam, which is why it takes a press itself.
  const fetchAt = items.findIndex((item) => item.fetchesOnOpen === true)

  return (
    // `relative`, so the control resolves against the album and not the page.
    // As wide as the layout, which a lone portrait can draw narrower than `width`.
    <YStack position="relative" group="album" width={layout.width} testID={testID}>
      {/* Rows rather than absolute rects, so the tiles mirror with the reading direction. Each
          row's widths and seams sum to the album's width exactly, so nothing is left to flex. */}
      <YStack gap={ALBUM_SEAM}>
        {layout.rows.map((row, r) => (
          <XStack key={row.tiles[0]?.at ?? r} gap={ALBUM_SEAM}>
            {row.tiles.map((tile) => (
              <AlbumTile
                key={tile.at}
                item={items[tile.at]}
                at={tile.at}
                width={tile.width}
                height={tile.height}
                overflowLabel={tile.at === overflowAt ? overflowText : undefined}
                name={nameOf(tile.at)}
                onOpen={onOpen}
                onAccent={onAccent}
                testID={tileTestID}
              />
            ))}
          </XStack>
        ))}
      </YStack>

      {fetchAt === -1 ? null : (
        <FetchHint
          side={Math.min(layout.width, layout.height)}
          group="album"
          restsOnTouch
          onPress={() => {
            onOpen(fetchAt)
          }}
          label={fetchLabel}
          testID={fetchTestID}
        />
      )}

      {control === undefined ? null : (
        // The album owns the corner; the control owns what it says. `flex-end` rather than an
        // inline inset, so it mirrors with the layout and nothing has to ask which way it reads.
        <YStack
          position="absolute"
          top={0}
          bottom={0}
          left={0}
          right={0}
          alignItems="flex-end"
          padding="$xs"
          pointerEvents="box-none"
        >
          {control}
        </YStack>
      )}
    </YStack>
  )
}
