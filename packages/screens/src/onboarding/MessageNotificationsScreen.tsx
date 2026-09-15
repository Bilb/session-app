import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Text, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { OnboardingStep } from './OnboardingStep'
import type { NotificationMode } from './flow'

interface MessageNotificationsScreenProps {
  onBack: () => void
  onContinue: (mode: NotificationMode) => void
  busy?: boolean
}

/**
 * Which way notifications arrive.
 *
 * The last screen of the create sequence, and **the point at which the account is actually made** --
 * everything before it was collected and held. It comes before the restore wait rather than after,
 * so that a restore is not fifteen seconds of nothing followed by a question.
 *
 * Fast mode is push and slow mode is polling. Where the build has no push service the fast option
 * is shown and marked unavailable rather than hidden: it is the recommended choice everywhere it
 * exists, and quietly dropping it makes polling look like the only design rather than the fallback.
 */
export function MessageNotificationsScreen({
  onBack,
  onContinue,
  busy = false,
}: MessageNotificationsScreenProps) {
  const fastAvailable = requirePorts().notifications.fastModeAvailable
  // Slow mode preselected where fast is unavailable, so the button is never the one that cannot
  // be used.
  const [mode, setMode] = useState<NotificationMode>(fastAvailable ? 'fast' : 'slow')

  const option = (
    value: NotificationMode,
    title: string,
    description: string,
    badge: string | null,
    disabled: boolean,
  ) => {
    const selected = mode === value
    return (
      <YStack
        role="radio"
        aria-checked={selected}
        gap="$0.5"
        padding="$2"
        borderRadius="$2"
        borderWidth={1}
        borderColor={selected ? '$primaryColor' : '$bordersColor'}
        backgroundColor="$backgroundSecondary"
        opacity={disabled ? 0.5 : 1}
        pointerEvents={disabled ? 'none' : 'auto'}
        cursor="pointer"
        onPress={() => {
          setMode(value)
        }}
        testID={ELEMENT.onboarding.notificationsOption(value)}
      >
        <XStack alignItems="center" gap="$1">
          {/* 17 on iOS and 16 on Android -- `h8`, and bold rather than semibold. Ours was 14. */}
          <Text size="$bodyLarge" weight="bold" flex={1}>
            {title}
          </Text>
          {badge === null ? null : (
            <Text size="$caption" tone={disabled ? 'secondary' : 'accent'}>
              {badge}
            </Text>
          )}
          {selected ? <Icon name="check" size="$4" color="$primaryColor" /> : null}
        </XStack>
        <Text tone="secondary" size="$label">
          {description}
        </Text>
      </YStack>
    )
  }

  return (
    <OnboardingStep
      title={tr('notificationsMessage')}
      description={tr('onboardingMessageNotificationExplanation')}
      onBack={onBack}
      testID={ELEMENT.onboarding.notificationsScreen}
      footer={
        <Button
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          onPress={() => {
            onContinue(mode)
          }}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <YStack gap="$1.5">
        {option(
          'fast',
          tr('notificationsFastMode'),
          tr('notificationsFastModeDescription'),
          fastAvailable ? tr('recommended') : tr('unavailable'),
          !fastAvailable,
        )}
        {option(
          'slow',
          tr('notificationsSlowMode'),
          tr('notificationsSlowModeDescription'),
          null,
          false,
        )}
      </YStack>
    </OnboardingStep>
  )
}
