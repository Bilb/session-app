import { logical, useTopBarControlsPadding } from '@session/ui'
import { createContext, useContext } from 'react'

import { SOLE_PANE, type Pane } from './panes'

const PaneContext = createContext<Pane>(SOLE_PANE)

export const PaneProvider = PaneContext.Provider

/**
 * Whether a back control has anywhere to go that is not already on screen.
 *
 * Beside the list it has not: the list is the way back, and a chevron pointing at it only empties
 * the pane. In one pane it is the only way back, which is also what a window narrowed with a
 * conversation open is left showing.
 */
export function useShowsBack(): boolean {
  return !useContext(PaneContext).besideList
}

/**
 * A top bar's leading padding where the window's controls would otherwise cover its first item,
 * and nothing where they would not -- spread after the bar's own padding, so it wins only there.
 *
 * The inset is where the platform says content may start, measured from the safe area, so it
 * replaces the bar's padding on that edge rather than adding to it.
 */
export function useTopBarLeading(): ReturnType<typeof logical> | Record<string, never> {
  const pane = useContext(PaneContext)
  const padding = useTopBarControlsPadding()
  return pane.atLeadingEdge && padding !== undefined ? logical({ paddingStart: padding }) : {}
}
