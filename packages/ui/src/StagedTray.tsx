import type { ElementId } from '@session/test-ids'
import { RADII } from '@session/theme-tokens'
import { useEffect, useRef, type ReactNode } from 'react'
import { ScrollView, type ScrollViewInstance } from 'react-native'
import { isWeb, XStack, YStack } from 'tamagui'

import { Button } from './Button'
import { Icon } from './Icon'
import { isLayoutRtl } from './layoutDirection'
import { PressArea } from './PressArea'
import { STAGED_TILE_SIDE } from './stagingMetrics'
import { Text } from './Text'
import { VISUALLY_HIDDEN } from './visuallyHidden'

/** Between tiles, and between the last tile and the add tile. */
const TILE_GAP = 8

export interface StagedTrayProps {
  /** "6 / 32", already worded. */
  countLabel: string
  /** The count as a screen reader says it, where the drawn one would read as a fraction. */
  countSpokenLabel: string
  clearLabel: string
  onClear: () => void
  clearDisabled?: boolean | undefined
  addLabel: string
  /** Absent when the message is full, which takes the add tile away rather than greying it. */
  onAdd?: (() => void) | undefined
  /**
   * How far across the rail starts, in px from its leading edge, set once its tiles are laid out.
   * For a capture that has to find the rail mid-way every time.
   */
  startOffset?: number | undefined
  /** The tiles, in order. */
  children: ReactNode
  testID: ElementId
  clearTestID: ElementId
  addTestID: ElementId
}

/** react-native-web's ScrollView hands back the scrolling element through this. */
interface WebScrollable {
  getScrollableNode?: () => HTMLElement | null
}

/**
 * Everything staged in the composer, as one row that scrolls across.
 *
 * One row at every size rather than a grid that grows: the composer sits under the transcript, and
 * a tray that grew with the count would push the conversation off the screen at thirty-two.
 */
export function StagedTray({
  countLabel,
  countSpokenLabel,
  clearLabel,
  onClear,
  clearDisabled = false,
  addLabel,
  onAdd,
  startOffset,
  children,
  testID,
  clearTestID,
  addTestID,
}: StagedTrayProps) {
  // React Native's ScrollView rather than tamagui's, whose ref type is the component's.
  const rail = useRef<ScrollViewInstance>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!isWeb) return
    const node = (rail.current as unknown as WebScrollable | null)?.getScrollableNode?.() ?? null
    if (node === null) return
    // A mouse wheel only scrolls down, which a rail that scrolls across would ignore.
    const across = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      if (node.scrollWidth <= node.clientWidth) return
      event.preventDefault()
      node.scrollBy({ left: isLayoutRtl() ? -event.deltaY : event.deltaY })
    }
    node.addEventListener('wheel', across, { passive: false })
    return () => {
      node.removeEventListener('wheel', across)
    }
  }, [])

  return (
    <YStack gap="$2xs" testID={testID}>
      <XStack position="relative" alignItems="center" justifyContent="space-between">
        {/* The web ignores a label on plain text, so there the spoken count is text of its own. */}
        <Text
          size="$label"
          color="$textSecondary"
          {...(isWeb ? { 'aria-hidden': true } : { 'aria-label': countSpokenLabel })}
        >
          {countLabel}
        </Text>
        {isWeb ? (
          <Text position="absolute" width={1} height={1} overflow="hidden" style={VISUALLY_HIDDEN}>
            {countSpokenLabel}
          </Text>
        ) : null}
        <Button
          variant="ghost"
          size="xs"
          disabled={clearDisabled}
          onPress={onClear}
          testID={clearTestID}
        >
          {clearLabel}
        </Button>
      </XStack>
      {/* The scrollbar says there is more: a finger swipes the rail, a pointer drags it. */}
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator
        onContentSizeChange={() => {
          if (startOffset === undefined || started.current) return
          started.current = true
          // Chromium counts a right-to-left scroller's offset down from 0, and react-native-web
          // passes it through as it is.
          rail.current?.scrollTo({
            x: isLayoutRtl() ? -startOffset : startOffset,
            animated: false,
          })
        }}
      >
        {/* Room for the scrollbar under the tiles rather than against them. */}
        <XStack gap={TILE_GAP} paddingBottom="$xs">
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
    </YStack>
  )
}
