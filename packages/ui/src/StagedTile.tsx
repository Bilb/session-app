import type { ElementId } from '@session/test-ids'
import { RADII } from '@session/theme-tokens'
import { useState } from 'react'
import { isWeb, XStack, YStack } from 'tamagui'

import { fileFormat, fileGlyph, nameDirection } from './attachmentFile'
import { TILE_HAIRLINE_WIDTH, TILE_SCRIM } from './attachmentTileStyle'
import { FileName } from './FileName'
import { Icon } from './Icon'
import { Image } from './Image'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { NOTHING_HEARD, previewFailed, previewLoaded, stagedPreview } from './stagedPreview'
import { STAGED_TILE_SIDE } from './stagingMetrics'
import { Text } from './Text'

/** The drawn disc under the remove cross. Its press area is the corner square, not this. */
const REMOVE_DISC = 22

/** The corner a remove press takes: the app's touch floor, drawn or not. */
const REMOVE_TARGET = 44

/**
 * React Native makes a view with a role no accessibility element, so without this VoiceOver and
 * TalkBack read the face's texts one by one and never its label.
 */
const NATIVE_ELEMENT = isWeb ? {} : { accessible: true }

export interface StagedTileProps {
  name: string
  contentType?: string | undefined
  /** Already formatted, since the units are the screen's to word. */
  sizeLabel?: string | undefined
  /**
   * libsession's thumbnail of the file, where it is a picture.
   *
   * Drawn over the document face once it loads, and dropped for good if it fails, so a file that
   * turns out not to decode reads as the document it is. A video has no still here yet.
   */
  previewUrl?: string | undefined
  /** What a screen reader calls the tile: its name, and its size where known. */
  label: string
  onRemove: () => void
  removeDisabled?: boolean | undefined
  /** Names the file, since every tile has one and "Remove" six times says nothing. */
  removeLabel: string
  testID: ElementId
  removeTestID: ElementId
  /** The thumbnail's picture, for a test asking whether it loaded. */
  previewTestID: ElementId
}

/**
 * The document face: what a staged file is when there is no picture of it.
 *
 * The same glyph, format and name a file row draws, so the tray and the message the tray
 * becomes read as the same files.
 */
function DocumentFace({
  name,
  contentType,
  sizeLabel,
}: Pick<StagedTileProps, 'name' | 'contentType' | 'sizeLabel'>) {
  const format = fileFormat(name)
  return (
    <YStack flex={1} padding="$xs" paddingTop="$sm" gap="$2xs" aria-hidden>
      <XStack alignItems="center" gap="$2xs">
        <Icon name={fileGlyph(name, contentType)} size="sm" color="$textPrimary" />
        {format === '' ? null : (
          <Text size="$caption" weight="semibold" color="$textSecondary" numberOfLines={1}>
            {format}
          </Text>
        )}
      </XStack>
      <YStack flex={1} />
      {/* The name and its size in the name's direction, so they share an edge, as in a file row.
          The glyph keeps the layout's, clear of the remove button. */}
      <YStack gap="$2xs" style={{ direction: nameDirection(name) }}>
        <FileName name={name} size="$label" />
        {sizeLabel === undefined ? null : (
          <Text size="$caption" color="$textSecondary" numberOfLines={1}>
            {sizeLabel}
          </Text>
        )}
      </YStack>
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
  label,
  onRemove,
  removeDisabled = false,
  removeLabel,
  testID,
  removeTestID,
  previewTestID,
}: StagedTileProps) {
  const [heard, setHeard] = useState(NOTHING_HEARD)
  const { url: preview, shown } = stagedPreview(previewUrl, heard)
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
      {/* Beside the remove button rather than around it: a native screen reader reads a labelled
          container as one element, and would swallow the button inside. */}
      <YStack flex={1} role="img" aria-label={label} {...NATIVE_ELEMENT}>
        <DocumentFace name={name} contentType={contentType} sizeLabel={sizeLabel} />
        {preview === undefined ? null : (
          // Over the face, hidden until it loads: a picture still decoding shows the face.
          <YStack position="absolute" top={0} bottom={0} left={0} right={0} opacity={shown ? 1 : 0}>
            <Image
              uri={preview}
              width={STAGED_TILE_SIDE}
              height={STAGED_TILE_SIDE}
              fit="cover"
              resizeMultiplier={4 / 3}
              onLoad={() => {
                setHeard((current) => previewLoaded(current, preview))
              }}
              onError={() => {
                setHeard((current) => previewFailed(current, preview))
              }}
              testID={previewTestID}
            />
          </YStack>
        )}
      </YStack>
      <YStack position="absolute" top={0} {...logical({ insetEnd: 0 })}>
        <PressArea
          onPress={onRemove}
          disabled={removeDisabled}
          accessibilityLabel={removeLabel}
          testID={removeTestID}
        >
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
                <Icon
                  name="x"
                  size="xs"
                  color={removeDisabled ? '$textDisabled' : '$surfaceInverted'}
                />
              </YStack>
            </YStack>
          )}
        </PressArea>
      </YStack>
    </YStack>
  )
}
