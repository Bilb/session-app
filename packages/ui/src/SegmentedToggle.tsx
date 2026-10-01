import { XStack, YStack } from 'tamagui'

import type { ElementId } from '@session/test-ids'

import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { FEEDBACK_TRANSITION } from './feedbackTransition'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import { SEGMENT_PADDING, selectedSegment, toggleSlop } from './segmentedToggleLayout'
import {
  SEGMENT_HEIGHT,
  SEGMENT_TAPS,
  SEGMENT_TARGET,
  SEGMENT_WIDTH,
} from './segmentedToggleMetrics'
import { StateLayer } from './StateLayer'

export type Segment<V> = {
  value: V
  icon: IconName
  /**
   * Already worded; what a screen reader announces the segment as, since it is drawn as a glyph.
   */
  label: string
  testID: ElementId
}

export type SegmentedToggleProps<V> = {
  /** Always exactly two: a third option is a menu, not a toggle. */
  segments: readonly [Segment<V>, Segment<V>]
  value: V
  onChange: (value: V) => void
  /** The whole control: the one target on touch, and the group on the web. */
  testID: ElementId
}

function SegmentFace({ segment, selected }: { segment: Segment<unknown>; selected: boolean }) {
  return (
    <YStack
      width={SEGMENT_WIDTH}
      height={SEGMENT_HEIGHT}
      borderRadius="$sm"
      alignItems="center"
      justifyContent="center"
      position="relative"
      group="control"
      cursor="pointer"
      backgroundColor={selected ? '$backgroundPrimary' : 'transparent'}
      style={FEEDBACK_TRANSITION}
      {...PRESS_PASSTHROUGH}
    >
      <StateLayer group="control" tone="ink" borderRadius="$sm" />
      <Icon name={segment.icon} size="xs" color={selected ? '$textPrimary' : '$textSecondary'} />
    </YStack>
  )
}

function SegmentButton<V>({
  segment,
  selected,
  onChange,
}: {
  segment: Segment<V>
  selected: boolean
  onChange: (value: V) => void
}) {
  return (
    <PressArea
      onPress={() => {
        onChange(segment.value)
      }}
      accessibilityLabel={segment.label}
      testID={segment.testID}
    >
      {() => <SegmentFace segment={segment} selected={selected} />}
    </PressArea>
  )
}

/**
 * A choice between two ways of drawing the same thing, each drawn as a glyph.
 *
 * On touch the whole control flips the value and reads as a switch named after the second
 * segment, on while it is chosen; with a pointer each segment is its own button. See
 * `segmentedToggleMetrics` for why the two differ.
 */
export function SegmentedToggle<V>({ segments, value, onChange, testID }: SegmentedToggleProps<V>) {
  const selected = selectedSegment(segments, value)
  const track = {
    backgroundColor: '$backgroundTertiary',
    borderRadius: '$sm',
    padding: SEGMENT_PADDING,
    gap: SEGMENT_PADDING,
  } as const

  if (SEGMENT_TAPS === 'whole') {
    const [first, second] = segments
    return (
      <PressArea
        onPress={() => {
          onChange(selected === 1 ? first.value : second.value)
        }}
        role="switch"
        checked={selected === 1}
        accessibilityLabel={second.label}
        hitSlop={toggleSlop(SEGMENT_HEIGHT, SEGMENT_TARGET)}
        testID={testID}
      >
        {() => (
          <XStack {...track}>
            {segments.map((segment, at) => (
              // The segment's own id stays on its face, so a test can still ask which is chosen.
              <YStack key={segment.testID} testID={segment.testID}>
                <SegmentFace segment={segment} selected={at === selected} />
              </YStack>
            ))}
          </XStack>
        )}
      </PressArea>
    )
  }

  return (
    <XStack {...track} testID={testID}>
      {segments.map((segment, at) => (
        <SegmentButton
          key={segment.testID}
          segment={segment}
          selected={at === selected}
          onChange={onChange}
        />
      ))}
    </XStack>
  )
}
