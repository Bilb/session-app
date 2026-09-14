import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { OnboardingChrome } from './OnboardingChrome'

/** How far the back button sits outside the content column. The desktop client's own offset. */
const BACK_OFFSET = -36

/**
 * How tall a step's content is, whatever is in it.
 *
 * The desktop client's own number, and its comment says why: *"Min height should match the
 * onboarding step with the largest height -- this prevents the loading spinner from jumping around
 * while still keeping things centered."*
 *
 * **It belongs here rather than on the column**, which is where it first went and where it was
 * wrong. In the client the reserve sits on the back-button wrapper, so a step gets it by *opting
 * in* -- and the one screen with no back button, the landing screen, has no reserve at all and
 * stands at its natural height. Putting it a level up gave it to the landing screen too, which
 * top-aligned its short content in a 276px box and left it reading 71px high.
 *
 * The centring it refers to is two-sided: the reserve pushes short content up, and the lockup and
 * the gap above the step push it back down. Ours are 30 and 25, which are the client's numbers.
 */
const CONTENT_MIN_HEIGHT = 276

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
      <YStack minHeight={CONTENT_MIN_HEIGHT}>
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

            {/* Held open, so the button does not move when a message arrives. The padding below is
              the error's own rather than the button's: a message that runs to two lines otherwise
              ends up almost touching the control. */}
            <YStack minHeight={ERROR_MIN_HEIGHT} paddingTop="$1.5" paddingBottom="$1.5">
              {error}
            </YStack>

            {footer}
          </YStack>
        </XStack>
      </YStack>
    </OnboardingChrome>
  )
}
