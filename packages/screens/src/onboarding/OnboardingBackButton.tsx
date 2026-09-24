import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { logical, backChevron, BarButton, YStack } from '@session/ui'

/**
 * The way back out of an onboarding step, drawn in four places.
 *
 * A bar button, so on iOS 26 it sits on glass like the back in the system's own bar on the Help
 * screen, and elsewhere is the desktop's circle. Told what back means because onboarding's steps
 * are not routes.
 */
export function OnboardingBackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <BarButton
      icon={backChevron()}
      accessibilityLabel={tr('back')}
      testID={ELEMENT.onboarding.back}
      onPress={onPress}
      disabled={disabled}
    />
  )
}

/** The control's width: a `md` circular bar button's. */
const BACK_WIDTH = 40

/**
 * Air between the control and the heading. Glass on iOS 26 makes the whole circle visible, so it
 * has to clear the text rather than only the glyph.
 */
const BACK_GAP = 6

/**
 * Where the heading starts, measured from the column's edge. The control and the heading share a
 * row, so moving one alone means the gap has to be taken out of the offset.
 */
const HEADING_INSET = 4

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
    <YStack
      // Negative, because the control hangs outside the fixed-width column rather than sitting in
      // it; the end margin is the gap, so the heading stays put however far out the control hangs.
      {...logical({ marginStart: HEADING_INSET - BACK_WIDTH - BACK_GAP, marginEnd: BACK_GAP })}
      height={34}
      justifyContent="center"
    >
      <OnboardingBackButton onPress={onPress} disabled={disabled} />
    </YStack>
  )
}
