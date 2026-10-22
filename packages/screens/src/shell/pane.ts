import { isRtlLocale } from '@session/localization'
import { usePaneSurface, useTopBarControlsPadding } from '@session/ui'
import { createContext, useContext } from 'react'

import { useLocale } from '../useLocale'
import { SOLE_PANE, type Pane } from './panes'

const PaneContext = createContext<Pane>(SOLE_PANE)

export const PaneProvider = PaneContext.Provider

/**
 * Whether a back control has anywhere to go that is not already on screen.
 *
 * Beside the list it has not: the list is the way back, and a chevron pointing at it would only
 * empty the pane. In one pane it is the only way back, which is also what a window narrowed with a
 * conversation open is left showing.
 */
export function useShowsBack(): boolean {
  return !useContext(PaneContext).besideList
}

/**
 * What a row or a button in the pane fills with while hovered and while selected or pressed.
 *
 * One step above the pane's surface. On the page that is `backgroundSecondary` and then
 * `backgroundTertiary`; on the recessed surface, already `backgroundSecondary`, both are
 * `backgroundNested`, since `backgroundTertiary` is measured from the page and sits too close to
 * the recessed surface to show. The legacy desktop draws hover and selection alike there too.
 */
export function usePaneHighlights(): {
  hover: '$backgroundSecondary' | '$backgroundNested'
  selected: '$backgroundTertiary' | '$backgroundNested'
} {
  return usePaneSurface() === '$backgroundSecondary'
    ? { hover: '$backgroundNested', selected: '$backgroundNested' }
    : { hover: '$backgroundSecondary', selected: '$backgroundTertiary' }
}

/**
 * A top bar's padding on whichever physical side the window's controls would otherwise cover its
 * content, and nothing elsewhere -- spread after the bar's own padding, so it wins only there.
 *
 * The pane knows its corners by reading direction and the platform reports the controls by
 * physical side, so the in-app language maps one onto the other: in Arabic the list sits on the
 * right and its start corner is the right one. The inset is where the platform says content may
 * start, measured from the safe area, so it replaces the bar's padding on that side.
 */
export function useTopBarInsets():
  { style: { paddingLeft?: number; paddingRight?: number } } | Record<string, never> {
  const { corners } = useContext(PaneContext)
  const rtl = isRtlLocale(useLocale())
  const { left, right } = useTopBarControlsPadding()
  if (corners === 'none') return {}
  const touchesLeft = corners === 'both' || (corners === 'start') !== rtl
  const touchesRight = corners === 'both' || (corners === 'end') !== rtl
  const style = {
    ...(touchesLeft && left !== undefined ? { paddingLeft: left } : {}),
    ...(touchesRight && right !== undefined ? { paddingRight: right } : {}),
  }
  return Object.keys(style).length > 0 ? { style } : {}
}

const RailContext = createContext(false)

/** Set by `AdaptiveShell` around the panes it draws beside the rail. */
export const RailProvider = RailContext.Provider

/**
 * Whether the rail is on screen beside this pane, which holds the controls a pane would otherwise
 * draw itself: the account's avatar, and with it the way into settings.
 */
export function useBesideRail(): boolean {
  return useContext(RailContext)
}
