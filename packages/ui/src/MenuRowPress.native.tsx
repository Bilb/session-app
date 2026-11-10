import { Platform, Pressable } from 'react-native'

import type { MenuRowPressProps } from './MenuRowPress.types'

export type { MenuRowPressProps }

/**
 * react-native gives `menuitem` no trait on iOS, so VoiceOver would read the label as plain text;
 * a button is what UIKit's own menu rows are announced as. Android says "menu item".
 */
const ROLE = Platform.OS === 'ios' ? 'button' : 'menuitem'

/**
 * The native half: react-native's `Pressable`, for the platform's own press rules (see
 * PressArea.native.tsx), announced as a menu item. There is no tab index to rove on a phone; a
 * screen reader steps through the rows itself.
 */
export function MenuRowPress({
  active,
  disabled,
  expanded,
  onActivate,
  nodeRef,
  testID,
  children,
}: MenuRowPressProps) {
  return (
    <Pressable
      ref={nodeRef as never}
      accessibilityRole={ROLE}
      accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }}
      disabled={disabled}
      onPress={onActivate}
      testID={testID}
    >
      {({ pressed }) => children(pressed || active)}
    </Pressable>
  )
}
