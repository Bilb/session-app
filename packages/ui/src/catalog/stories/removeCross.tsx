import { RADII } from '@session/theme-tokens'
import { XStack, YStack } from 'tamagui'

import { TILE_HAIRLINE_WIDTH, TILE_SCRIM } from '../../attachmentTileStyle'
import { Icon } from '../../Icon'
import { Image } from '../../Image'
import { logical } from '../../logicalEdges'
import { STAGED_TILE_SIDE } from '../../stagingMetrics'
import { Text } from '../../Text'
import { useCatalogPicture } from '../pictures'
import { defineStory } from '../story'

/**
 * Candidates for the staged tile's remove cross, each over the backgrounds it has to survive. A
 * comparison to choose from, drawn here rather than in `StagedTile` until one is chosen.
 */
type CrossStyle = 'current' | 'scrimDisc' | 'themeDisc' | 'cornerBadge' | 'bareCross'

const DISC = 22
const TILE_GAP = 12
/** How far a corner badge sits past the tile's edge. */
const BADGE_OUTSET = 7

/** The catalog photographs that are a pale sky, a dark scene, a busy one and a mid grey. */
const BACKGROUNDS = [7, 8, 1, 9] as const

function Cross({ style }: { style: CrossStyle }) {
  switch (style) {
    case 'current':
      return (
        <YStack
          width={DISC}
          height={DISC}
          borderRadius="$full"
          backgroundColor={TILE_SCRIM}
          borderWidth={TILE_HAIRLINE_WIDTH}
          borderColor="$surfaceInverted"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="x" size="xs" color="$surfaceInverted" />
        </YStack>
      )
    case 'scrimDisc':
      return (
        <YStack
          width={DISC}
          height={DISC}
          borderRadius="$full"
          backgroundColor={TILE_SCRIM}
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="x" size="xs" color="$surfaceInverted" />
        </YStack>
      )
    case 'themeDisc':
    case 'cornerBadge':
      return (
        <YStack
          width={DISC}
          height={DISC}
          borderRadius="$full"
          backgroundColor="$backgroundPrimary"
          shadowColor="$shadow"
          shadowRadius={4}
          shadowOffset={{ width: 0, height: 1 }}
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="x" size="xs" color="$textPrimary" />
        </YStack>
      )
    case 'bareCross':
      return (
        <YStack
          width={DISC}
          height={DISC}
          alignItems="center"
          justifyContent="center"
          style={{ filter: 'drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.9))' }}
        >
          <Icon name="x" size="sm" color="$surfaceInverted" />
        </YStack>
      )
  }
}

function Face({ picture }: { picture: number | undefined }) {
  const uri = useCatalogPicture(picture)
  if (picture === undefined || uri === undefined)
    return (
      <YStack flex={1} padding="$xs" backgroundColor="$backgroundSecondary" gap="$2xs">
        <Icon name="fileText" size="sm" color="$textSecondary" />
        <Text size="$caption" color="$textSecondary">
          PDF
        </Text>
      </YStack>
    )
  return <Image uri={uri} width={STAGED_TILE_SIDE} height={STAGED_TILE_SIDE} fit="cover" />
}

function Candidate({ style, picture }: { style: CrossStyle; picture: number | undefined }) {
  const outside = style === 'cornerBadge'
  return (
    <YStack position="relative" width={STAGED_TILE_SIDE} height={STAGED_TILE_SIDE}>
      <YStack flex={1} borderRadius={RADII.md} overflow="hidden">
        <Face picture={picture} />
      </YStack>
      <YStack
        position="absolute"
        top={outside ? -BADGE_OUTSET : 0}
        {...logical({ insetEnd: outside ? -BADGE_OUTSET : 0 })}
        padding={outside ? 0 : '$2xs'}
      >
        <Cross style={style} />
      </YStack>
    </YStack>
  )
}

function Strip({ style }: { style: CrossStyle }) {
  return (
    <XStack gap={TILE_GAP} paddingTop={BADGE_OUTSET} paddingHorizontal={BADGE_OUTSET}>
      <Candidate style={style} picture={undefined} />
      {BACKGROUNDS.map((picture) => (
        <Candidate key={picture} style={style} picture={picture} />
      ))}
    </XStack>
  )
}

export const removeCross = defineStory<{ style: CrossStyle }>({
  component: 'removeCross',
  story: 'candidates',
  width: 5 * STAGED_TILE_SIDE + 4 * TILE_GAP + 2 * BADGE_OUTSET,
  sensitive: {},
  variants: {
    current: { style: 'current' },
    scrimDisc: { style: 'scrimDisc' },
    themeDisc: { style: 'themeDisc' },
    cornerBadge: { style: 'cornerBadge' },
    bareCross: { style: 'bareCross' },
  },
  render: (row) => <Strip {...row} />,
})
