import { RADII } from '@session/theme-tokens'
import { useRef, useState, type ElementRef, type ReactNode } from 'react'
import { ScrollView, XStack, YStack } from 'tamagui'

import { backChevron, forwardChevron } from './backChevron'
import { Button } from './Button'
import { Icon } from './Icon'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { STAGED_TILE_SIDE, TRAY_SCROLL_BUTTONS } from './stagingMetrics'
import { Text } from './Text'

/** Between tiles, and between the last tile and the add tile. */
const TILE_GAP = 8

/** How far previous or next moves the rail: most of what is in view, so one tile stays in sight. */
const PAGE_FRACTION = 0.8

export interface StagedTrayProps {
  /** "6 / 32", already worded. */
  countLabel: string
  clearLabel: string
  onClear: () => void
  addLabel: string
  /** Absent when the message is full, which takes the add tile away rather than greying it. */
  onAdd?: (() => void) | undefined
  previousLabel: string
  nextLabel: string
  /** The tiles, in order. */
  children: ReactNode
  testID: string
  clearTestID: string
  addTestID: string
}

interface RailExtent {
  offset: number
  visible: number
  content: number
}

/**
 * Everything staged in the composer, as one row that scrolls across.
 *
 * One row at every size rather than a grid that grows: the composer sits under the transcript, and
 * a tray that grew with the count would push the conversation off the screen at thirty-two.
 */
export function StagedTray({
  countLabel,
  clearLabel,
  onClear,
  addLabel,
  onAdd,
  previousLabel,
  nextLabel,
  children,
  testID,
  clearTestID,
  addTestID,
}: StagedTrayProps) {
  const rail = useRef<ElementRef<typeof ScrollView>>(null)
  const [extent, setExtent] = useState<RailExtent>({ offset: 0, visible: 0, content: 0 })
  const canGoBack = extent.offset > 1
  const canGoOn = extent.offset + extent.visible < extent.content - 1

  function page(direction: 1 | -1): void {
    const x = Math.max(0, extent.offset + direction * extent.visible * PAGE_FRACTION)
    rail.current?.scrollTo({ x, animated: true })
  }

  return (
    <YStack gap="$2xs" testID={testID}>
      <XStack alignItems="center" justifyContent="space-between">
        <Text size="$label" color="$textSecondary">
          {countLabel}
        </Text>
        <Button variant="ghost" size="xs" onPress={onClear} testID={clearTestID}>
          {clearLabel}
        </Button>
      </XStack>
      <YStack position="relative">
        <ScrollView
          ref={rail}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
            setExtent({
              offset: contentOffset.x,
              visible: layoutMeasurement.width,
              content: contentSize.width,
            })
          }}
          onLayout={(event) => {
            const visible = event.nativeEvent.layout.width
            setExtent((was) => ({ ...was, visible }))
          }}
          onContentSizeChange={(content) => {
            setExtent((was) => ({ ...was, content }))
          }}
        >
          <XStack gap={TILE_GAP}>
            {children}
            {onAdd === undefined ? null : (
              <PressArea onPress={onAdd} accessibilityLabel={addLabel} testID={addTestID}>
                {() => (
                  <YStack
                    width={STAGED_TILE_SIDE}
                    height={STAGED_TILE_SIDE}
                    borderRadius={RADII.md}
                    borderWidth={1.5}
                    borderStyle="dashed"
                    // Not the border role: at 1.3:1 a dashed edge is the one thing that says this
                    // is a place to add, so it takes the muted text, which clears 3:1 everywhere.
                    borderColor="$textSecondary"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon name="plus" size="md" color="$textSecondary" />
                  </YStack>
                )}
              </PressArea>
            )}
          </XStack>
        </ScrollView>
        {TRAY_SCROLL_BUTTONS && canGoBack ? (
          <YStack
            position="absolute"
            {...logical({ insetStart: 0 })}
            top={0}
            bottom={0}
            justifyContent="center"
          >
            <Button
              variant="tonal"
              size="sm"
              circular
              icon={<Icon name={backChevron()} size="sm" color="$textPrimary" />}
              accessibilityLabel={previousLabel}
              onPress={() => {
                page(-1)
              }}
            />
          </YStack>
        ) : null}
        {TRAY_SCROLL_BUTTONS && canGoOn ? (
          <YStack
            position="absolute"
            {...logical({ insetEnd: 0 })}
            top={0}
            bottom={0}
            justifyContent="center"
          >
            <Button
              variant="tonal"
              size="sm"
              circular
              icon={<Icon name={forwardChevron()} size="sm" color="$textPrimary" />}
              accessibilityLabel={nextLabel}
              onPress={() => {
                page(1)
              }}
            />
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
