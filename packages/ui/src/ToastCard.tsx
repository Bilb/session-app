import { XStack, YStack } from 'tamagui'

import { Icon } from './Icon'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { Text } from './Text'
import { offScaleText } from './textHeight'
import { useTokenColor } from './useTokenColor'

/**
 * The desktop client's toast, measured: its `SessionToast` inside react-toastify's defaults, which
 * it leaves as they are. None of it sits on a scale.
 *
 * Down the block, the library's 8 around the toast and 6 around its body, then the client's own 10
 * -- 24 above and below. Across, the same 8 and 6 then the client's 5 before a 30 glyph and 15
 * after it. The library's width and 6 radius, and its close cross 8 in from the top trailing
 * corner at 70% until the pointer is on it.
 */
const WIDTH = 320
const RADIUS = 6
const GLYPH = 30
const TEXT_SIZE = 13
const STRIP = 4
const TOAST_PADDING = 8
const BODY_PADDING = 6
const CLIENT_PADDING_BLOCK = 10
const GLYPH_BEFORE = 5
const GLYPH_AFTER = 15
const CLOSE_GLYPH = 14
const CLOSE_RESTING = 0.7

/**
 * One toast.
 *
 * The same strip and glyph for every kind of message, as the client draws them: it does not
 * colour the strip by type, and its glyph takes the text colour whatever the type. A press
 * anywhere on it dismisses it.
 */
export function ToastCard({
  text,
  onPress,
  closeLabel,
  testID,
}: {
  text: string
  onPress: () => void
  /** Names the close cross for a screen reader, since it is drawn as a glyph. */
  closeLabel: string
  testID: string
}) {
  const accent = useTokenColor('$primaryColor')
  const shadow = useTokenColor('$shadow')
  return (
    <XStack
      width={WIDTH}
      maxWidth="100%"
      // The close cross is placed against the toast rather than laid out in it.
      position="relative"
      alignItems="center"
      paddingVertical={TOAST_PADDING + BODY_PADDING + CLIENT_PADDING_BLOCK}
      backgroundColor="$backgroundSecondary"
      borderRadius={RADIUS}
      boxShadow={`0px 4px 12px 0px ${shadow}`}
      cursor="pointer"
      userSelect="none"
      pointerEvents="auto"
      role="status"
      onPress={onPress}
      testID={testID}
      {...logical({
        borderStartWidth: STRIP,
        borderStartColor: accent,
        paddingStart: TOAST_PADDING + BODY_PADDING + GLYPH_BEFORE,
        // Clear of the cross, so a long message wraps before it.
        paddingEnd: TOAST_PADDING * 2 + CLOSE_GLYPH,
      })}
    >
      <YStack {...logical({ marginEnd: GLYPH_AFTER })}>
        <Icon name="info" size={GLYPH} color="$textPrimary" />
      </YStack>
      <Text flex={1} {...offScaleText(TEXT_SIZE)}>
        {text}
      </Text>
      {/* The cross the library draws in the top trailing corner. The whole toast already closes
          on a press; this is the control that says so, and the one a screen reader names. */}
      <YStack position="absolute" top={0} {...logical({ insetEnd: 0 })}>
        <PressArea accessibilityLabel={closeLabel} onPress={onPress}>
          {() => (
            <YStack padding={TOAST_PADDING} opacity={CLOSE_RESTING} hoverStyle={{ opacity: 1 }}>
              <Icon name="x" size={CLOSE_GLYPH} color="$textPrimary" />
            </YStack>
          )}
        </PressArea>
      </YStack>
    </XStack>
  )
}
