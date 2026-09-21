import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { logical, backChevron, Button, Icon, YStack } from '@session/ui'

/**
 * The way back out of an onboarding step, drawn in four places.
 *
 * `md` so the pressed highlight covers the touch target rather than just the glyph. Told what back
 * means because onboarding's steps are not routes.
 */
export function OnboardingBackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="md"
      circular
      accessibilityLabel={tr('back')}
      testID={ELEMENT.onboarding.back}
      onPress={onPress}
      disabled={disabled}
      icon={<Icon name={backChevron()} size="lg" color="$textPrimary" />}
    />
  )
}

/** Negative, because the control hangs outside the fixed-width column rather than sitting in it. */
const BACK_OFFSET = -36

/**
 * The same control, hung off the side of the wide column.
 *
 * The fixed height pins it to the heading's first line, so it stays level however many lines the
 * title wraps to.
 */
export function WideBackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <YStack {...logical({ marginStart: BACK_OFFSET })} height={34} justifyContent="center">
      <OnboardingBackButton onPress={onPress} disabled={disabled} />
    </YStack>
  )
}
