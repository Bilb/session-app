import { YStack } from 'tamagui'

import { useForcedFocus } from './interactionOverride'
import { focusRing } from './keyboardPress'
import type { MenuRowPressProps } from './MenuRowPress.types'

export type { MenuRowPressProps }

/** Inside the row, since the panel clips at its rounded corners. */
const ROW_RING = focusRing({ onAccent: false, offset: -2, radius: '$sm' })

/**
 * The web half: a `menuitem` with a roving tab index, so the menu is one stop and the arrow keys,
 * which the panel handles, move between its rows.
 *
 * A disabled row keeps its stop and says it is disabled, as WAI-ARIA's menu pattern asks, so a
 * keyboard user reads the whole menu; it simply does nothing when chosen. The highlight is the
 * active row, which the pointer moves as well as the keys, so the two never show different rows.
 */
export function MenuRowPress({
  active,
  tabStop,
  disabled,
  expanded,
  onActivate,
  onHover,
  nodeRef,
  testID,
  children,
}: MenuRowPressProps) {
  const forcedFocus = useForcedFocus()
  return (
    <YStack
      ref={nodeRef as never}
      role="menuitem"
      tabIndex={tabStop ? 0 : -1}
      aria-disabled={disabled}
      {...(expanded === undefined ? {} : { 'aria-haspopup': 'menu', 'aria-expanded': expanded })}
      userSelect="none"
      focusVisibleStyle={ROW_RING}
      {...(active ? forcedFocus : {})}
      onPress={disabled ? undefined : onActivate}
      onMouseMove={active ? undefined : onHover}
      testID={testID}
    >
      {children(active)}
    </YStack>
  )
}
