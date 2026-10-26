import { createContext, useContext } from 'react'
import { isWeb } from 'tamagui'

export interface ForcedInteraction {
  hovered: boolean
  pressed: boolean
  focused: boolean
}

/** Set by the component catalog alone, to draw a hover, a press or focus without a pointer. */
export const InteractionOverride = createContext<ForcedInteraction | null>(null)

const FORCED_FOCUS = { forceStyle: 'focusVisible' } as const

/** For a tab stop to spread: draws its `focusVisibleStyle` ring while the catalog forces focus. */
export function useForcedFocus(): typeof FORCED_FOCUS | Record<string, never> {
  const forced = useContext(InteractionOverride)
  return isWeb && forced?.focused === true ? FORCED_FOCUS : {}
}
