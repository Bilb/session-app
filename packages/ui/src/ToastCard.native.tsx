import { YStack } from 'tamagui'

import { PressArea } from './PressArea'
import { Text } from './Text'
import { raisedShadow } from './shadowColour'
import type { ToastCardProps } from './ToastCard.types'
import { useTokenColor } from './useTokenColor'

/**
 * One toast on a phone: a line of text in a pill, the shape the platform's own toast takes.
 *
 * No glyph and no accent strip: the width is the screen's, and a strip down the leading edge of a
 * full-width bar reads as a stray border rather than an accent. No close cross either -- a press
 * anywhere on it dismisses it, so the whole pill is the control the close id names.
 */
export function ToastCard({ text, onPress, testID, closeTestID }: ToastCardProps) {
  const shadow = useTokenColor('$shadow')
  return (
    <PressArea accessibilityLabel={text} testID={closeTestID} onPress={onPress}>
      {() => (
        <YStack
          paddingVertical="$xs"
          paddingHorizontal="$xl"
          borderRadius="$full"
          backgroundColor="$backgroundSecondary"
          boxShadow={`0px 4px 12px 0px ${raisedShadow(shadow)}`}
          role="status"
        >
          <Text size="$bodyLarge" textAlign="center" testID={testID}>
            {text}
          </Text>
        </YStack>
      )}
    </PressArea>
  )
}
