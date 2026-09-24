import { Button } from './Button'
import { useGlass } from './glass'
import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { PressArea } from './PressArea'
import { SIZE_SCALE } from './scales'
import { useThemeIsDark } from './UIProvider'

export interface BarButtonProps {
  icon: IconName
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
  testID?: string | undefined
}

/** The diameter: a `md` circular button's, so glass and circle take the same room. */
const DIAMETER = SIZE_SCALE['2xl']

/**
 * A close or back beside a title, drawn the way the platform draws its own.
 *
 * **On glass where there is glass** -- iOS 26, where every bar button sits on it, including the ones
 * the system draws in a native bar -- so a close drawn here and one in the system's bar read as one
 * control. **Elsewhere the desktop's circle**, which fills while held: the glyph alone would give
 * no sign of being pressed.
 */
export function BarButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  testID,
}: BarButtonProps) {
  const Glass = useGlass()
  const dark = useThemeIsDark()
  const glyph = <Icon name={icon} size="lg" color={disabled ? '$textDisabled' : '$textPrimary'} />

  if (Glass === null)
    return (
      <Button
        variant="ghost"
        size="md"
        circular
        accessibilityLabel={accessibilityLabel}
        {...(testID === undefined ? {} : { testID })}
        onPress={onPress}
        disabled={disabled}
        icon={glyph}
      />
    )

  return (
    <PressArea
      accessibilityLabel={accessibilityLabel}
      {...(testID === undefined ? {} : { testID })}
      onPress={onPress}
      disabled={disabled}
    >
      {() => (
        <Glass size={DIAMETER} dark={dark}>
          {glyph}
        </Glass>
      )}
    </PressArea>
  )
}
