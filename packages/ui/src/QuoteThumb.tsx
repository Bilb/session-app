import { Spinner, YStack } from 'tamagui'

import { AttachmentTile } from './AttachmentTile'
import { TILE_SCRIM, tileRadius } from './attachmentTileStyle'
import { Icon } from './Icon'
import { logical } from './logicalEdges'
import type { QuoteInk, QuoteVisual } from './quotePreview'
import { Text } from './Text'
import type { WithTestID } from './with'

/** A badge's inset from the picture's corner, and its own corner: below the radius ladder. */
const BADGE_INSET_PX = 3
const BADGE_RADIUS_PX = 4

/** How far a glyph's tile tints its bubble towards its ink: the quote's own tint, once more. */
export const QUOTE_GLYPH_TILE_OPACITY = 0.1

/**
 * A quote's square, after the stripe: its picture, through the same tile the album draws
 * (thumbnail, then ThumbHash, then the flat tile), or a glyph on a plain tile.
 *
 * `busy` replaces what is there with a spinner, so the quote keeps its size while it pages.
 */
export function QuoteThumb({
  visual,
  sidePx,
  ink,
  busy = false,
  testID,
}: WithTestID & {
  visual: QuoteVisual | null
  sidePx: number
  ink: QuoteInk
  busy?: boolean | undefined
}) {
  const radius = tileRadius(sidePx)

  if (busy)
    return (
      <YStack
        width={sidePx}
        height={sidePx}
        alignItems="center"
        justifyContent="center"
        aria-hidden
      >
        <Spinner size="small" color={ink} />
      </YStack>
    )

  if (visual === null) return null

  if (visual.type === 'glyph')
    return (
      <YStack
        position="relative"
        width={sidePx}
        height={sidePx}
        borderRadius={radius}
        overflow="hidden"
        alignItems="center"
        justifyContent="center"
        aria-hidden
      >
        <YStack
          position="absolute"
          top={0}
          bottom={0}
          left={0}
          right={0}
          backgroundColor={ink}
          opacity={QUOTE_GLYPH_TILE_OPACITY}
        />
        <Icon name={visual.icon} size="md" color={ink} />
      </YStack>
    )

  return (
    <YStack position="relative" width={sidePx} height={sidePx} aria-hidden>
      <AttachmentTile
        width={sidePx}
        height={sidePx}
        uri={visual.uri}
        thumbhash={visual.thumbhash}
        testID={testID}
      />
      {visual.badge === undefined ? null : (
        <YStack
          position="absolute"
          bottom={BADGE_INSET_PX}
          {...logical({ insetEnd: BADGE_INSET_PX })}
          paddingHorizontal="$3xs"
          borderRadius={BADGE_RADIUS_PX}
          backgroundColor={TILE_SCRIM}
        >
          <Text size="$caption" weight="bold" color="$surfaceInverted" numberOfLines={1}>
            {visual.badge}
          </Text>
        </YStack>
      )}
    </YStack>
  )
}
