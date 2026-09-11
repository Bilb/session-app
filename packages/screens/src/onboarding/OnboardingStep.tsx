import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { OnboardingChrome } from './OnboardingChrome'

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
 * The heading, content and control every onboarding step after the landing screen shares.
 *
 * One shape rather than five screens each arranging their own: the steps are read one after
 * another, and a title that moves between them reads as a different app each time.
 *
 * The artwork, the Session lockup and the column width all come from `OnboardingChrome`, which is
 * where the two designs actually differ. What is left here is the same on both.
 */
export function OnboardingStep({
  title,
  description,
  onBack,
  children,
  footer,
  testID,
}: OnboardingStepProps) {
  return (
    <OnboardingChrome testID={testID}>
      <YStack flex={1} gap="$3">
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

        {footer === undefined ? null : <YStack paddingTop="$2">{footer}</YStack>}
      </YStack>
    </OnboardingChrome>
  )
}
