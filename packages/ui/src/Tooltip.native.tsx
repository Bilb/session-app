import { useEffect, useRef, useState } from 'react'
import { type PointerEvent, View, type ViewStyle } from 'react-native'
import { YStack } from 'tamagui'

import { logical } from './logicalEdges'
import { SPACE_SCALE } from './scales'
import { Text } from './Text'
import type { TooltipProps } from './Tooltip.types'
import type { TooltipPlacement } from './tooltipPosition'
import { useTokenColor } from './useTokenColor'

export type { TooltipProps }

/** As the web's: long enough that sweeping a pointer across the rail does not flash each one. */
const HOVER_DELAY_MS = 150
const GAP_PX = SPACE_SCALE.xs
const MAX_WIDTH_PX = 240
const LAYER = 10

/**
 * The box the bubble is centred in, beside the control on `placement`'s side. React Native has no
 * percentage transform to centre the bubble itself, so it is laid out in a box as long as the
 * control along one axis and as wide as the bubble may grow along the other, and centred there.
 */
function slot(placement: TooltipPlacement): ViewStyle {
  switch (placement) {
    case 'end':
      return {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: MAX_WIDTH_PX,
        justifyContent: 'center',
        alignItems: 'flex-start',
        ...logical({ insetStart: '100%', marginStart: GAP_PX }).style,
      }
    case 'start':
      return {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: MAX_WIDTH_PX,
        justifyContent: 'center',
        alignItems: 'flex-end',
        ...logical({ insetEnd: '100%', marginEnd: GAP_PX }).style,
      }
    case 'top':
    case 'bottom':
      return {
        position: 'absolute',
        ...(placement === 'top'
          ? { bottom: '100%', marginBottom: GAP_PX }
          : { top: '100%', marginTop: GAP_PX }),
        ...logical({ insetStart: '50%', marginStart: -MAX_WIDTH_PX / 2 }).style,
        width: MAX_WIDTH_PX,
        alignItems: 'center',
      }
  }
}

/**
 * The native half: nothing for a finger, a bubble for a pointer.
 *
 * Neither phone platform shows a tooltip on its own controls, and a long press would be a gesture
 * nobody discovers, so touch gets the control alone; VoiceOver and TalkBack already read its label.
 * A pointer on an iPad is the exception, as UIKit's own buttons show one: a resting pointer opens
 * the bubble, leaving or pressing closes it, the same as on the desktop.
 */
export function Tooltip({ label, placement = 'end', children, testID }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shadow = useTokenColor('$shadow')
  useEffect(() => () => clearTimeout(pending.current), [])

  const hide = (): void => {
    clearTimeout(pending.current)
    setOpen(false)
  }

  return (
    <View
      style={{ position: 'relative', ...(open ? { zIndex: LAYER } : {}) }}
      onPointerEnter={(event: PointerEvent) => {
        if (event.nativeEvent.pointerType === 'touch') return
        clearTimeout(pending.current)
        pending.current = setTimeout(() => {
          setOpen(true)
        }, HOVER_DELAY_MS)
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
    >
      {children}
      {open ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={slot(placement)}
        >
          <YStack
            backgroundColor="$messageBubbleIncomingBg"
            borderRadius="$sm"
            paddingVertical="$2xs"
            paddingHorizontal="$md"
            boxShadow={`0px 0px 13px 0px ${shadow}`}
            maxWidth={MAX_WIDTH_PX}
            testID={testID}
          >
            <Text size="$body" color="$messageBubbleIncomingText">
              {label}
            </Text>
          </YStack>
        </View>
      ) : null}
    </View>
  )
}
