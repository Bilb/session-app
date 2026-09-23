import { View } from 'react-native'

import type { DirectionRootProps } from './DirectionRoot.types'

export type { DirectionRootProps }

/**
 * Lays its children out in the given direction.
 *
 * **This is what actually mirrors the app on a device.** Yoga resolves `start`, `end`,
 * `marginStart` and the rest against the direction of the node they sit under, and it re-resolves
 * them when that changes -- so moving this one prop mirrors every logical edge in the tree on the
 * next layout pass. `I18nManager` is the usual answer and cannot do this: it is read once when the
 * bridge starts, so it only ever mirrors the launch after the one somebody changed the language in.
 *
 * A bare view rather than a stack, because it must add nothing of its own: it stretches to its
 * parent and passes the direction down, and anything else it contributed would land on every
 * screen.
 */
export function DirectionRoot({ rtl, children }: DirectionRootProps) {
  return <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>{children}</View>
}
