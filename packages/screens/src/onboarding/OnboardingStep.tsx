import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { OnboardingChrome } from './OnboardingChrome'

/** How far the back button sits outside the content column, and how far down. Both the client's. */
const BACK_OFFSET = -36
const BACK_TOP = 6

interface OnboardingStepProps {
  title: string
  description?: string
  /** Drawn beside the title. The recovery screen has one; nothing else does. */
  titleMark?: ReactNode
  /** Omitted on the steps there is nowhere to go back from. */
  onBack?: () => void
  children: ReactNode
  /** The control that moves on. */
  footer?: ReactNode
  testID: string
}

/**
 * The heading, content and control every onboarding step after the landing screen shares.
 *
 * One shape rather than five screens each arranging their own: the steps are read one after
 * another, and a title that moves between them reads as a different app each time.
 *
 * The back button hangs outside the column to the left rather than sitting above the title, which
 * is what the desktop client does -- the content keeps its left edge across every step and the
 * chevron does not push the heading down or across.
 *
 * The artwork, the Session lockup and the column width all come from `OnboardingChrome`, which is
 * where the two designs actually differ.
 */
export function OnboardingStep({
  title,
  description,
  titleMark,
  onBack,
  children,
  footer,
  testID,
}: OnboardingStepProps) {
  return (
    <OnboardingChrome testID={testID}>
      <XStack>
        {onBack === undefined ? null : (
          <YStack marginLeft={BACK_OFFSET} marginTop={BACK_TOP}>
            <Button
              variant="ghost"
              size="xs"
              circular
              accessibilityLabel={tr('back')}
              testID={ELEMENT.onboarding.back}
              onPress={onBack}
              icon={<Icon name="chevronLeft" size="$5" color="$textPrimary" />}
            />
          </YStack>
        )}

        <YStack flex={1} gap="$1.5">
          <XStack alignItems="center" gap="$1.5">
            {/* 26/700, from the designs -- and the desktop client agrees: its `OnboardHeading`
                is an h3 at `--font-size-h4`, which is 26px. */}
            <Text size="$headingLarge" weight="bold">
              {title}
            </Text>
            {titleMark}
          </XStack>

          {description === undefined ? null : (
            // 14/400, and not muted: the desktop client draws this in the primary text colour, and
            // it is the only explanation of what the field below is for -- content, not a caption.
            <Text size="$body">{description}</Text>
          )}

          <YStack paddingTop="$1.5" gap="$2.5">
            {children}
            {footer}
          </YStack>
        </YStack>
      </XStack>
    </OnboardingChrome>
  )
}
