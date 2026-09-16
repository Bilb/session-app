import { flag, type NotificationsPort, requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, RadioIndicator, Text, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { OnboardingStep } from './OnboardingStep'
import type { NotificationMode } from './flow'

interface MessageNotificationsScreenProps {
  onBack: () => void
  onContinue: (mode: NotificationMode) => void
  busy?: boolean
}

/**
 * The row's metrics. 16 across and 12 down inside the border (Android's; iOS pads 16 all round),
 * 8 between the lines, and **24 between the border and the radio** -- a gutter both clients leave,
 * because the radio sits outside the box rather than inside it.
 */
const BOX_PADDING_X = 16
const BOX_PADDING_Y = 12
const TEXT_GAP = 8
const ROW_GAP = 24

/**
 * The description of fast mode, by whose servers it would use.
 *
 * Three strings in the catalogue and only one of them is true of any given build -- an iOS build
 * saying "Google's notification Servers" is simply wrong, and it is what ours said. The fallback is
 * the unqualified one, for a build with no push service to name at all.
 */
function fastModeDescription(service: NotificationsPort['pushService']): string {
  if (service === 'apple') return tr('notificationsFastModeDescriptionIos')
  if (service === 'huawei') return tr('notificationsFastModeDescriptionHuawei')
  return tr('notificationsFastModeDescription')
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
  // The flag is a way to look at the screen, not a second source of truth: see its entry in the
  // flag table for why the recommended state is otherwise unreachable on a development machine.
  const notifications = requirePorts().notifications
  const fastAvailable = notifications.fastModeAvailable || flag('forceFastModeAvailable')
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
      /**
       * **A bordered box with a radio beside it, and no fill.** Both clients draw it this way: a
       * border around the text only, and the radio outside it in a 24pt gutter to the trailing
       * side, centred against the whole text block rather than against the title. Neither fills
       * the box, and neither changes it on selection -- the dot is the entire signal.
       */
      <XStack
        role="radio"
        aria-checked={selected}
        alignItems="center"
        gap={ROW_GAP}
        pointerEvents={disabled ? 'none' : 'auto'}
        cursor="pointer"
        onPress={() => {
          setMode(value)
        }}
        testID={ELEMENT.onboarding.notificationsOption(value)}
      >
        <YStack
          flex={1}
          gap={TEXT_GAP}
          paddingHorizontal={BOX_PADDING_X}
          paddingVertical={BOX_PADDING_Y}
          borderRadius="$2"
          borderWidth={1}
          borderColor="$bordersColor"
        >
          {/* 17 on iOS and 16 on Android -- `h8`, and bold rather than semibold. */}
          {/* Dimmed by taking the disabled colour rather than by fading the row: Android swaps
              the token and leaves the border alone, so an unavailable option still reads as a
              box rather than as a smudge. */}
          <Text
            size="$bodyLarge"
            weight="bold"
            {...(disabled ? { tone: 'disabled' as const } : {})}
          >
            {title}
          </Text>
          {/* 12 regular, in the **primary** text colour on both clients. Ours was muted, which is
              what made the row read as disabled. */}
          <Text size="$label" {...(disabled ? { tone: 'disabled' as const } : {})}>
            {description}
          </Text>
          {/* Below the description rather than beside the title, which is where both clients put
              it -- Android as another line in the same column, iOS as a third label in its stack.
              14 bold in the accent. */}
          {badge === null ? null : (
            <Text size="$body" weight="bold" tone={disabled ? 'secondary' : 'accent'}>
              {badge}
            </Text>
          )}
        </YStack>
        <RadioIndicator selected={selected} disabled={disabled} />
      </XStack>
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
          // Outlined in the accent, like every other onboarding Continue. This screen had the
          // filled one, which made it look like the end of the flow rather than one step of it.
          variant="outlineAccent"
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
          fastModeDescription(notifications.pushService),
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
