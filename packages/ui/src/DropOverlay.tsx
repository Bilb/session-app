import { hexColorToRGB } from '@session/theme-tokens'
import { YStack } from 'tamagui'

import { Icon } from './Icon'
import { Text } from './Text'
import { useTokenColor } from './useTokenColor'

/** How much of the page shows through: enough to see it is still the conversation. */
const PAGE_SCRIM_OPACITY = 0.9

/** The accent's share of the tint. Text on it is checked against the result, not the accent. */
const ACCENT_TINT_OPACITY = 0.14

/** The disc the glyph sits in. */
const DISC = 72

export interface DropOverlayProps {
  title: string
  hint: string
  testID?: string | undefined
}

/**
 * What a conversation becomes while files are held over it.
 *
 * Nothing about the files themselves: the operating system already draws what is being dragged.
 *
 * **The outline is the accent text, not the accent.** A light theme's accent fill is about 1.3:1
 * against the tint, so the edge would vanish exactly where it is the only edge there is.
 */
export function DropOverlay({ title, hint, testID }: DropOverlayProps) {
  const page = hexColorToRGB(useTokenColor('$backgroundPrimary'))
  const accent = hexColorToRGB(useTokenColor('$primaryColor'))
  return (
    <YStack
      flex={1}
      padding="$md"
      backgroundColor={`rgba(${page}, ${String(PAGE_SCRIM_OPACITY)})`}
      testID={testID}
    >
      <YStack
        flex={1}
        borderWidth={2}
        borderStyle="dashed"
        borderColor="$accentText"
        borderRadius="$xl"
        backgroundColor={`rgba(${accent}, ${String(ACCENT_TINT_OPACITY)})`}
        alignItems="center"
        justifyContent="center"
        gap="$md"
      >
        <YStack
          width={DISC}
          height={DISC}
          borderRadius="$full"
          backgroundColor="$primaryColor"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="filePlus" size="lg" color="$onAccent" />
        </YStack>
        <Text size="$heading" weight="semibold">
          {title}
        </Text>
        <Text size="$body">{hint}</Text>
      </YStack>
    </YStack>
  )
}
