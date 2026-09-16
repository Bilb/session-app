import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { backChevron, Button, Icon, YStack } from '@session/ui'

/**
 * The way back out of an onboarding step.
 *
 * One control drawn in four places -- the phone's bar, the wide column's hanger, and the loading
 * screen in each of its two layouts -- which had grown three separate copies of the same six
 * props. The fourth was the one that gave it away: the loading screen has a chevron on a phone and
 * had none on the wide design, because nothing there was in a position to draw one.
 *
 * `md` rather than `xs`: the glyph is the same either way, and the control is the size of the
 * touch target rather than of the icon, so the pressed highlight covers what a finger covers. An
 * `xs` button grown only by `hitSlop` presses in a 24pt square inside a 40pt target, which reads
 * as a mis-hit even when it worked.
 *
 * `BackButton` in `screens` is the app's own, which goes back through the navigator. Onboarding's
 * steps are not routes, so this one is told what back means.
 */
export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      variant="ghost"
      size="md"
      circular
      accessibilityLabel={tr('back')}
      testID={ELEMENT.onboarding.back}
      onPress={onPress}
      icon={<Icon name={backChevron()} size="$5" color="$textPrimary" />}
    />
  )
}

/**
 * How far outside the column the wide design hangs the chevron.
 *
 * The desktop client's own offset. The column is a fixed width and the control belongs beside it
 * rather than in it, so this is negative: a phone has no such margin to hang into, which is why
 * that layout puts the control in a bar instead.
 */
const BACK_OFFSET = -36

/**
 * The same control, hung off the side of the wide column.
 *
 * The height pins it to the heading's line rather than to the column, so it stays level however
 * many lines the title wraps to.
 */
export function WideBackButton({ onPress }: { onPress: () => void }) {
  return (
    <YStack marginStart={BACK_OFFSET} height={34} justifyContent="center">
      <OnboardingBackButton onPress={onPress} />
    </YStack>
  )
}
