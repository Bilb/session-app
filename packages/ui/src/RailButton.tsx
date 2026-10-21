import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

import type { FocusRingShape } from './keyboardPress'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import { StateLayer } from './StateLayer'

/** Just inside the square, which sits flush with its neighbours down the rail. */
const RING: FocusRingShape = { onAccent: false, offset: -2, radius: '$full' }

export interface RailButtonProps {
  /** The square the control takes, which is its hit area: each rail item names its own. */
  sidePx: number
  accessibilityLabel: string
  onPress: () => void
  testID?: string | undefined
  /** What is drawn at the centre of the square. */
  children: ReactNode
}

/**
 * One control down the side rail: a square hit area with its content centred, lit on hover and
 * press by a round layer the size of the square.
 *
 * Its own component rather than `Button`, whose sizes are control heights: the rail's items keep
 * the legacy desktop's hit areas, which are not on that ladder.
 */
export function RailButton({
  sidePx,
  accessibilityLabel,
  onPress,
  testID,
  children,
}: RailButtonProps) {
  return (
    <PressArea
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      ring={RING}
      {...(testID === undefined ? {} : { testID })}
    >
      {(pressed, hovered) => (
        <YStack
          width={sidePx}
          height={sidePx}
          alignItems="center"
          justifyContent="center"
          position="relative"
          group="control"
          $platform-web={{ cursor: 'pointer' }}
          // The `group` would otherwise give the frame tamagui's own press handling on native,
          // which claims the touch before the PressArea round it sees it.
          {...PRESS_PASSTHROUGH}
        >
          <StateLayer
            group="control"
            tone="ink"
            borderRadius="$full"
            pressed={pressed}
            atRest={hovered}
          />
          {children}
        </YStack>
      )}
    </PressArea>
  )
}
