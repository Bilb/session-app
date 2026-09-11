import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Screen, Text, useMedia, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

interface OnboardingStepProps {
  title: string
  description?: string
  /** Omitted on the steps there is nowhere to go back from. */
  onBack?: () => void
  children: ReactNode
  /** The control that moves on, kept at the foot of the screen where it is always in the same place. */
  footer?: ReactNode
  testID: string
}

/**
 * The frame every onboarding step after the landing screen is drawn in.
 *
 * One frame rather than five screens each arranging their own heading, because the steps are read
 * one after another: a title that moves between them reads as a different app each time.
 *
 * **Two layouts, keyed on width rather than on platform.** The phone one fills the screen and puts
 * the control at the bottom; the wide one centres a column, which is what the desktop client does
 * and what a tablet should do too. `gtSm` is >700px, so a phone in either orientation is narrow
 * and a tablet is wide -- which is the intended reading, since the instruction is that a tablet
 * takes the desktop design rather than a stretched phone one.
 */
export function OnboardingStep({
  title,
  description,
  onBack,
  children,
  footer,
  testID,
}: OnboardingStepProps) {
  const wide = useMedia().gtSm

  return (
    <Screen padded testID={testID}>
      <XStack minHeight="$7" alignItems="center">
        {onBack === undefined ? null : (
          <Button
            variant="ghost"
            size="sm"
            accessibilityLabel={tr('back')}
            testID={ELEMENT.onboarding.back}
            onPress={onBack}
            icon={<Icon name="chevronLeft" size="$5" color="$textPrimary" />}
          />
        )}
      </XStack>

      <YStack
        flex={1}
        gap="$3"
        // Centred in a column on a wide window, top-aligned and full width on a phone. The column
        // is capped rather than proportional so the measure stays readable on a very wide monitor.
        {...(wide
          ? { alignSelf: 'center', width: '100%', maxWidth: 460, justifyContent: 'center' }
          : {})}
      >
        <YStack gap="$1">
          <Text size="$headingLarge" weight="bold">
            {title}
          </Text>
          {description === undefined ? null : (
            <Text tone="secondary" size="$body">
              {description}
            </Text>
          )}
        </YStack>

        {children}

        {/* On a wide window the control sits directly under the content, because the column is
            centred and a control pinned to the bottom of a tall window is a long way from it. On a
            phone it is pinned, which is where a thumb expects it. */}
        {wide && footer !== undefined ? <YStack>{footer}</YStack> : null}
      </YStack>

      {!wide && footer !== undefined ? <YStack paddingTop="$2">{footer}</YStack> : null}
    </Screen>
  )
}
