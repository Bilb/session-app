import { XStack, YStack } from 'tamagui'

import type { ElementId } from '@session/test-ids'

import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { FEEDBACK_TRANSITION } from './feedbackTransition'
import { PressArea } from './PressArea'
import { SEGMENT_PADDING, selectedSegment } from './segmentedToggleLayout'
import { SEGMENT_HEIGHT, SEGMENT_WIDTH } from './segmentedToggleMetrics'
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
      {() => (
        <YStack
          width={SEGMENT_WIDTH}
          height={SEGMENT_HEIGHT}
          borderRadius="$sm"
          alignItems="center"
          justifyContent="center"
          position="relative"
          group="control"
          $platform-web={{ cursor: 'pointer' }}
          backgroundColor={selected ? '$backgroundPrimary' : 'transparent'}
          style={FEEDBACK_TRANSITION}
        >
          <StateLayer group="control" tone="ink" borderRadius="$sm" />
          <Icon
            name={segment.icon}
            size="xs"
            color={selected ? '$textPrimary' : '$textSecondary'}
          />
        </YStack>
      )}
    </PressArea>
  )
}

/** A choice between two ways of drawing the same thing, each drawn as a glyph. */
export function SegmentedToggle<V>({ segments, value, onChange }: SegmentedToggleProps<V>) {
  const selected = selectedSegment(segments, value)
  return (
    <XStack
      backgroundColor="$backgroundTertiary"
      borderRadius="$sm"
      padding={SEGMENT_PADDING}
      gap={SEGMENT_PADDING}
    >
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
