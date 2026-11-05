import { Pressable } from 'react-native'

import type { ContextMenuTargetProps } from './ContextMenuTarget.types'

export type { ContextMenuTargetProps }

/**
 * The native half: a long press opens the menu under the finger.
 *
 * Not an accessibility element itself, so what it wraps stays separately reachable: as one, the
 * wrapper would hide its children from VoiceOver. A control inside takes the touch first, so a long
 * press that starts on one does not open the menu.
 */
export function ContextMenuTarget({ onOpen, children }: ContextMenuTargetProps) {
  return (
    <Pressable
      accessible={false}
      onLongPress={(event) => {
        onOpen({ kind: 'point', x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })
      }}
    >
      {children}
    </Pressable>
  )
}
