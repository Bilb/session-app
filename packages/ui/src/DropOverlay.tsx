import type { ElementId } from '@session/test-ids'
import { YStack } from 'tamagui'

import { Icon } from './Icon'
import { Text } from './Text'

/** How much of the page shows through: enough to see it is still the conversation. */
const PAGE_OPACITY = 0.9

/** The accent's share of the tint. Text on it is checked against the result, not the accent. */
const ACCENT_TINT_OPACITY = 0.14

/** The disc the glyph sits in. */
const DISC = 72

export interface DropOverlayProps {
  title: string
  hint: string
  testID?: ElementId | undefined
}

/** A layer filling its parent, for stacking token colours by opacity instead of mixing them. */
function Fill({ color, opacity, radius }: { color: string; opacity: number; radius?: string }) {
  return (
    <YStack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      backgroundColor={color}
      opacity={opacity}
      {...(radius === undefined ? {} : { borderRadius: radius })}
    />
  )
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
  return (
    <YStack flex={1} padding="$md" position="relative" testID={testID}>
      <Fill color="$backgroundPrimary" opacity={PAGE_OPACITY} />
      <YStack
        flex={1}
        position="relative"
        borderWidth={2}
        borderStyle="dashed"
        borderColor="$accentText"
        borderRadius="$xl"
        alignItems="center"
        justifyContent="center"
        gap="$md"
        paddingHorizontal="$lg"
      >
        <Fill color="$primaryColor" opacity={ACCENT_TINT_OPACITY} radius="$xl" />
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
        <Text size="$heading" weight="semibold" textAlign="center">
          {title}
        </Text>
        <Text size="$body" textAlign="center">
          {hint}
        </Text>
      </YStack>
    </YStack>
  )
}
