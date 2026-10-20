import { memo, type ReactNode } from 'react'
import { XStack, YStack } from 'tamagui'

import type {
  WithDurationLabel,
  WithFetchesOnOpen,
  WithMediaPreview,
  WithMediaUri,
} from '@session/basic-types'

import { ALBUM_SEAM, albumLayout, lastCell } from './albumLayout'
import { AttachmentTile } from './AttachmentTile'
import { FetchHint } from './FetchHint'
import { tileRadius } from './attachmentTileStyle'
import { StateLayer } from './StateLayer'
import type { WithTestID } from './with'

type AlbumMedia = WithMediaUri & WithMediaPreview & WithFetchesOnOpen & WithTestID
export type AlbumImage = AlbumMedia & { kind: 'image' }
export type AlbumVideo = AlbumMedia & { kind: 'video' } & WithDurationLabel
export type AlbumItem = AlbumImage | AlbumVideo

export type AttachmentAlbumProps = WithTestID & {
  items: readonly AlbumItem[]
  /** The message's own width. Never a constant: an album is as wide as the bubble it sits in. */
  width: number
  /** Already worded, because `@session/ui` cannot reach the catalogue. */
  overflowLabel: (count: number) => string
  onOpen: (at: number) => void
  /**
   * The set's own badge, drawn in the album's corner.
   *
   * The corner rather than the middle of a tile: a badge on a tile reads as that tile's state, and
   * this one is about the whole message, including the attachments behind "+N".
   */
  control?: ReactNode | undefined
}

/**
 * The cell arrives as `at` and `side` rather than as itself: `albumLayout` builds new cells on
 * every render, and `memo` would see each one as a change.
 */
const AlbumTile = memo(function AlbumTile({
  item,
  at,
  side,
  overflowLabel,
  onOpen,
}: {
  /** Absent only where the layout and the items disagree, which draws nothing. */
  item: AlbumItem | undefined
  at: number
  side: number
  /** Only on the tile that carries the overflow. */
  overflowLabel?: string | undefined
  onOpen: (at: number) => void
}) {
  if (item === undefined) return null
  return (
    <YStack
      role="button"
      position="relative"
      $platform-web={{ cursor: 'pointer' }}
      onPress={() => {
        onOpen(at)
      }}
      group="tile"
    >
      <AttachmentTile
        side={side}
        kind={item.kind}
        uri={item.uri}
        preview={item.preview}
        duration={item.kind === 'video' ? item.duration : undefined}
        overflowLabel={overflowLabel}
        testID={item.testID}
      />
      <StateLayer group="tile" tone="scrim" borderRadius={tileRadius(side)} />
      {item.fetchesOnOpen === true ? <FetchHint side={side} /> : null}
    </YStack>
  )
})

/**
 * Every picture on one message, as one object.
 *
 * The geometry is `albumLayout`'s, so this places and never measures. The set's own control is
 * handed in rather than built here: what it says is a fact about the message's transfers, which
 * this package knows nothing about, and where it sits is a fact about the shape, which the layout
 * already answered.
 */
export function AttachmentAlbum({
  items,
  width,
  overflowLabel,
  onOpen,
  control,
  testID,
}: AttachmentAlbumProps) {
  const layout = albumLayout(items.length, width)
  const last = lastCell(layout)

  const overflowAt = layout.overflow > 0 ? last?.at : undefined
  const overflowText = overflowAt === undefined ? undefined : overflowLabel(layout.overflow)

  const beside = (
    <YStack gap={ALBUM_SEAM}>
      {layout.rows.map((row, at) => (
        <XStack key={row[0]?.at ?? at} gap={ALBUM_SEAM}>
          {row.map((cell) => (
            <AlbumTile
              key={cell.at}
              item={items[cell.at]}
              at={cell.at}
              side={cell.side}
              overflowLabel={cell.at === overflowAt ? overflowText : undefined}
              onOpen={onOpen}
            />
          ))}
        </XStack>
      ))}
    </YStack>
  )

  return (
    // `relative`, so the control resolves against the album and not the page.
    <YStack position="relative" testID={testID}>
      {layout.lead === null ? (
        beside
      ) : (
        <XStack gap={ALBUM_SEAM}>
          <AlbumTile
            item={items[layout.lead.at]}
            at={layout.lead.at}
            side={layout.lead.side}
            overflowLabel={layout.lead.at === overflowAt ? overflowText : undefined}
            onOpen={onOpen}
          />
          {layout.rows.length === 0 ? null : beside}
        </XStack>
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
