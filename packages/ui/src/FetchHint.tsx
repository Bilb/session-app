import { YStack } from 'tamagui'

import { TILE_SCRIM } from './attachmentTileStyle'
import { FEEDBACK_TRANSITION } from './feedbackTransition'
import { Icon } from './Icon'

/** Below this a tile has room for the small glyph only, as `VideoAffordances` decides. */
const LARGE_TILE = 90

/**
 * A cloud over a picture a press would download rather than open, shown while the `tile` group
 * above it is hovered or pressed, which needs `position="relative"`. Drawn like the video badge,
 * on the fixed photo scrim.
 */
export function FetchHint({ side }: { side: number }) {
  const small = side < LARGE_TILE
  return (
    <YStack
      position="absolute"
      top={0}
      bottom={0}
      left={0}
      right={0}
      alignItems="center"
      justifyContent="center"
      opacity={0}
      pointerEvents="none"
      style={FEEDBACK_TRANSITION}
      $group-tile-hover={{ opacity: 0.8 }}
      $group-tile-press={{ opacity: 1 }}
    >
      <YStack padding={small ? '$3xs' : '$xs'} borderRadius="$full" backgroundColor={TILE_SCRIM}>
        <Icon name="cloudDownload" size={small ? 'xs' : 'md'} color="$textPrimary" />
      </YStack>
    </YStack>
  )
}
