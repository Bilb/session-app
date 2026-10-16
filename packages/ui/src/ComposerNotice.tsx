import type { ElementId } from '@session/test-ids'
import { useEffect, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import { isWeb, XStack, YStack } from 'tamagui'

import { Button } from './Button'
import { Icon } from './Icon'
import { Text } from './Text'

export interface ComposerNoticeProps {
  message: string
  /** What it was about: a file's name and size, or how many were left out. */
  detail?: string | undefined
  /** Changes with each refusal, so a second identical one is announced again. */
  announceKey: number
  onDismiss: () => void
  dismissLabel: string
  testID: ElementId
  dismissTestID: ElementId
}

/**
 * Why the composer did not take something, said where it happened rather than in a toast.
 *
 * **The words are body text and only the glyph is red.** The danger colour clears 4.5:1 on the
 * page but not on the composer's surface in the dark themes (4.0:1), and the glyph needs only 3:1.
 */
export function ComposerNotice({
  message,
  detail,
  announceKey,
  onDismiss,
  dismissLabel,
  testID,
  dismissTestID,
}: ComposerNoticeProps) {
  const spoken = [message, detail].filter(Boolean).join('. ')
  const latest = useRef(spoken)
  latest.current = spoken
  // `role="alert"` is announced on the web; neither mobile screen reader announces a view that
  // merely appears. Keyed on the refusal, not the words: the same file refused twice is two.
  useEffect(() => {
    if (!isWeb) AccessibilityInfo.announceForAccessibility(latest.current)
  }, [announceKey])

  return (
    <XStack
      role="alert"
      alignItems="center"
      gap="$xs"
      paddingVertical="$2xs"
      paddingHorizontal="$sm"
      borderRadius="$md"
      backgroundColor="$backgroundTertiary"
      testID={testID}
    >
      <Icon name="triangleAlert" size="sm" color="$dangerColor" />
      <YStack flex={1} minWidth={0} gap="$3xs" paddingVertical="$2xs">
        <Text size="$body" weight="semibold">
          {message}
        </Text>
        {detail === undefined ? null : (
          <Text size="$label" color="$textSecondary" numberOfLines={1}>
            {detail}
          </Text>
        )}
      </YStack>
      <Button
        variant="ghost"
        size="sm"
        circular
        icon={<Icon name="x" size="sm" color="$textSecondary" />}
        accessibilityLabel={dismissLabel}
        onPress={onDismiss}
        testID={dismissTestID}
      />
    </XStack>
  )
}
