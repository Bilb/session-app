import { RADII } from '@session/theme-tokens'
import { XStack, YStack } from 'tamagui'

import { fileFormat, fileGlyph, splitFilename } from './attachmentFile'
import { TILE_HAIRLINE_WIDTH, TILE_SCRIM } from './attachmentTileStyle'
import { Icon } from './Icon'
import { Image } from './Image'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { STAGED_TILE_SIDE } from './stagingMetrics'
import { Text } from './Text'

/** The drawn disc under the remove cross. Its press area is the corner square, not this. */
const REMOVE_DISC = 22

/** The corner a remove press takes: the app's touch floor, drawn or not. */
const REMOVE_TARGET = 44

export interface StagedTileProps {
  name: string
  contentType?: string | undefined
  /** Already formatted, since the units are the screen's to word. */
  sizeLabel?: string | undefined
  /**
   * A picture of the file, where the platform can draw one.
   *
   * Only for images: a video has no still here yet, so it draws as a document like every other
   * file that is not a picture.
   */
  previewUrl?: string | undefined
  onRemove: () => void
  removeLabel: string
  testID: string
  removeTestID: string
}

/**
 * The document face: what a staged file is when there is no picture of it.
 *
 * The same glyph, format and two-run name a file row draws, so the tray and the message the tray
 * becomes read as the same files.
 */
function DocumentFace({
  name,
  contentType,
  sizeLabel,
}: Pick<StagedTileProps, 'name' | 'contentType' | 'sizeLabel'>) {
  const { head, tail } = splitFilename(name)
  const format = fileFormat(name)
  return (
    <YStack flex={1} padding="$xs" paddingTop="$sm" gap="$2xs">
      <XStack alignItems="center" gap="$2xs">
        <Icon name={fileGlyph(name, contentType)} size="sm" color="$textPrimary" />
        {format === '' ? null : (
          <Text size="$caption" weight="semibold" color="$textSecondary" numberOfLines={1}>
            {format}
          </Text>
        )}
      </XStack>
      <YStack flex={1} />
      <XStack minWidth={0}>
        <Text size="$label" weight="semibold" numberOfLines={1} flexShrink={1}>
          {head}
        </Text>
        <Text size="$label" weight="semibold" numberOfLines={1} flexShrink={0}>
          {tail}
        </Text>
      </XStack>
      {sizeLabel === undefined ? null : (
        <Text size="$caption" color="$textSecondary" numberOfLines={1}>
          {sizeLabel}
        </Text>
      )}
    </YStack>
  )
}

/**
 * One file waiting in the composer: a picture of it or its document face, and a way to take it
 * out.
 *
 * Square at every size and with the album's hairline, so a picture with a white edge still has
 * one against the composer.
 */
export function StagedTile({
  name,
  contentType,
  sizeLabel,
  previewUrl,
  onRemove,
  removeLabel,
  testID,
  removeTestID,
}: StagedTileProps) {
  return (
    <YStack
      width={STAGED_TILE_SIDE}
      height={STAGED_TILE_SIDE}
      flexShrink={0}
      borderRadius={RADII.md}
      overflow="hidden"
      backgroundColor="$backgroundTertiary"
      borderWidth={TILE_HAIRLINE_WIDTH}
      borderColor="$separatorColor"
      position="relative"
      testID={testID}
    >
      {previewUrl === undefined ? (
        <DocumentFace name={name} contentType={contentType} sizeLabel={sizeLabel} />
      ) : (
        <Image uri={previewUrl} width={STAGED_TILE_SIDE} height={STAGED_TILE_SIDE} fit="cover" />
      )}
      <YStack position="absolute" top={0} {...logical({ insetEnd: 0 })}>
        <PressArea onPress={onRemove} accessibilityLabel={removeLabel} testID={removeTestID}>
          {() => (
            <YStack
              width={REMOVE_TARGET}
              height={REMOVE_TARGET}
              alignItems="flex-end"
              padding="$2xs"
            >
              <YStack
                width={REMOVE_DISC}
                height={REMOVE_DISC}
                borderRadius="$full"
                backgroundColor={TILE_SCRIM}
                alignItems="center"
                justifyContent="center"
              >
                <Icon name="x" size="xs" color="$surfaceInverted" />
              </YStack>
            </YStack>
          )}
        </PressArea>
      </YStack>
    </YStack>
  )
}
