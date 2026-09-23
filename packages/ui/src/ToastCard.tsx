import { XStack, YStack } from 'tamagui'

import { Icon } from './Icon'
import { logical } from './logicalEdges'
import { Text } from './Text'
import { offScaleText } from './textHeight'
import { useTokenColor } from './useTokenColor'

/**
 * The desktop client's `SessionToast` metrics, which sit on neither scale: a 30 glyph with 5 before
 * it and 15 after, 13 text, 10 above and below, and a 4 strip of the accent down the leading edge.
 * The width and radius are its toast library's own defaults, which the client does not override.
 */
const WIDTH = 320
const GLYPH = 30
const GLYPH_BEFORE = 5
const GLYPH_AFTER = 15
const TEXT_SIZE = 13
const PADDING_BLOCK = 10
const STRIP = 4

/**
 * One toast.
 *
 * The same strip and glyph for every kind of message, as the client draws them: it stopped
 * colouring the strip by type, and its glyph takes the text colour whatever the type. A press
 * anywhere on it dismisses it.
 */
export function ToastCard({
  text,
  onPress,
  testID,
}: {
  text: string
  onPress: () => void
  testID: string
}) {
  const accent = useTokenColor('$primaryColor')
  const shadow = useTokenColor('$shadow')
  return (
    <XStack
      width={WIDTH}
      maxWidth="100%"
      alignItems="center"
      paddingVertical={PADDING_BLOCK}
      backgroundColor="$backgroundSecondary"
      borderRadius="$sm"
      boxShadow={`0px 4px 12px 0px ${shadow}`}
      cursor="pointer"
      userSelect="none"
      pointerEvents="auto"
      role="status"
      onPress={onPress}
      testID={testID}
      {...logical({ borderStartWidth: STRIP, borderStartColor: accent, paddingEnd: GLYPH_AFTER })}
    >
      <YStack {...logical({ marginStart: GLYPH_BEFORE, marginEnd: GLYPH_AFTER })}>
        <Icon name="info" size={GLYPH} color="$textPrimary" />
      </YStack>
      <Text flex={1} {...offScaleText(TEXT_SIZE)}>
        {text}
      </Text>
    </XStack>
  )
}
