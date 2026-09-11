import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { OnboardingChrome } from './OnboardingChrome'

/** How far the back button sits outside the content column. The desktop client's own offset. */
const BACK_OFFSET = -36

/**
 * Room for two lines of error before anything below it moves.
 *
 * One line is the common case and two is reachable -- the recovery-phrase messages are long. Past
 * two it grows and pushes the button down, which is the designs' rule: the control sliding is
 * acceptable for an unusually long message, but not for the ordinary one.
 */
const ERROR_MIN_HEIGHT = 34

interface OnboardingStepProps {
  title: string
  description?: string
  /** Drawn beside the title. The recovery screen has one; nothing else does. */
  titleMark?: ReactNode
  onBack?: () => void
  children: ReactNode
  /** Sits between the field and the control, in space that is held whether or not it is filled. */
  error?: ReactNode
  footer?: ReactNode
  testID: string
}

/**
 * The heading, content and control every onboarding step after the landing screen shares.
 *
 * The back button hangs outside the column to the left and is centred on the title rather than
 * sitting above it -- the content keeps its left edge across every step and the chevron does not
 * push the heading down or across.
 *
 * The gap below the field is larger than the gap above the control, which is the designs' spacing
 * and not an accident: the error belongs to the field it is about, so it sits closer to the button
 * than to the input it describes would be wrong -- it reads as a caption on the field, and the
 * button is a separate thing further down.
 */
export function OnboardingStep({
  title,
  description,
  titleMark,
  onBack,
  children,
  error,
  footer,
  testID,
}: OnboardingStepProps) {
  return (
    <OnboardingChrome testID={testID}>
      <XStack>
        {onBack === undefined ? null : (
          // Centred on the title's line rather than the column: `alignSelf` against the heading
          // row keeps it level however many lines the title wraps to.
          <YStack marginLeft={BACK_OFFSET} height={34} justifyContent="center">
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

        <YStack flex={1}>
          <XStack alignItems="center" gap="$1.5" minHeight={34}>
            {/* 26/700, from the designs -- and the desktop client agrees: its `OnboardHeading` is
                an h3 at `--font-size-h4`, which is 26px. */}
            <Text size="$headingLarge" weight="bold" userSelect="none">
              {title}
            </Text>
            {titleMark}
          </XStack>

          {description === undefined ? null : (
            // 14/400, and not muted: the desktop client draws this in the primary text colour, and
            // it is the only explanation of what the field below is for -- content, not a caption.
            <Text size="$body" paddingTop="$1">
              {description}
            </Text>
          )}

          <YStack paddingTop="$2.5">{children}</YStack>

          {/* Held open, so the button does not move when a message arrives. */}
          <YStack minHeight={ERROR_MIN_HEIGHT} paddingTop="$1.5">
            {error}
          </YStack>

          {footer}
        </YStack>
      </XStack>
    </OnboardingChrome>
  )
}
