import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, useMedia, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { EXTRA_ACTION_INSET, OnboardingChrome } from './OnboardingChrome'

/**
 * How far the back button sits outside the content column. The desktop client's own offset.
 *
 * **Only where there is a margin to hang into.** On a phone the content is the screen, so this put
 * the control off the left edge of the display; the phone design draws its own in the row above
 * instead. See `OnboardingChrome`.
 */
const BACK_OFFSET = -36

/**
 * Room for two lines of error before anything below it moves.
 *
 * One line is the common case and two is reachable -- the recovery-phrase messages are long. Past
 * two it grows and pushes the button down, which is the designs' rule: the control sliding is
 * acceptable for an unusually long message, but not for the ordinary one.
 */
const ERROR_MIN_HEIGHT = 34

/**
 * How far above centre the block sits on a phone.
 *
 * iOS spends a button's height on this -- `largeButtonHeight`, 45 -- plus a capped spacer, and
 * Android reaches the same place by weighting the space above and below 1:2. Ours does both: the
 * 1:2 split carries most of it and this is the client's own remainder.
 */
const UPWARD_BIAS = 45

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
  /** Passed straight through to the chrome, which draws it in place of the Session mark. */
  barTitle?: string
  /** Passed straight through to the chrome, which draws it full width under the bar. */
  banner?: ReactNode
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
  barTitle,
  banner,
}: OnboardingStepProps) {
  const wide = useMedia().gtSm

  return (
    <OnboardingChrome
      testID={testID}
      {...(wide ? {} : { onBack })}
      {...(barTitle === undefined ? {} : { barTitle })}
      {...(banner === undefined ? {} : { banner })}
    >
      {/**
       * **Centred, and pulled upward — not top-aligned.** The legacy client splits the free space
       * with a spacer above and below, then pulls the block up again with a bottom padding of a
       * button's height and a third capped spacer. The result sits above the middle of the screen,
       * and ours started hard under the bar instead, which is the discrepancy that could not be seen
       * past to judge the keyboard avoidance.
       *
       * Only on the phone: the wide design centres its own reserved block already.
       */}
      {wide ? null : <YStack flex={1} />}
      <XStack {...(wide ? {} : { paddingBottom: UPWARD_BIAS })}>
        {!wide || onBack === undefined ? null : (
          // Centred on the title's line rather than the column: `alignSelf` against the heading
          // row keeps it level however many lines the title wraps to.
          <YStack marginLeft={BACK_OFFSET} height={34} justifyContent="center">
            <Button
              variant="ghost"
              // The size of the touch target rather than of the glyph. See the phone bar's.
              size="md"
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

          {/* On the wide design the action stays with the content, in a column that is already a
              fixed width. The phone's lives at the bottom of the screen -- see below. */}
          {wide ? footer : null}
        </YStack>
      </XStack>
      {/* Twice the weight of the spacer above, which is what leaves the block above centre. */}
      {wide ? null : <YStack flex={2} />}
      {wide ? null : (
        /**
         * **The action sits at the bottom of the screen, and that is also what makes the keyboard
         * behave.** Both clients pin it there. Because it is the last thing in a column the
         * keyboard-avoiding view is shrinking, it rises by the whole height of the keyboard --
         * while the content above, being centred in what is left, rises by about half of that.
         * Which is exactly what iOS does: the button comes up to meet the keyboard and the field
         * follows by less, rather than the whole screen sliding as one.
         */
        <YStack paddingHorizontal={EXTRA_ACTION_INSET} paddingBottom="$2">
          {footer}
        </YStack>
      )}
    </OnboardingChrome>
  )
}
