import { createContext, useContext } from 'react'

/**
 * The surface a pane is drawn on: the page, or the recessed `backgroundSecondary` a list is drawn
 * on beside the detail. A screen fills with it, and anything cut out of it -- an avatar's
 * ring -- draws in it so that the cut stays invisible.
 */
export type PaneSurface = '$backgroundPrimary' | '$backgroundSecondary'

const PaneSurfaceContext = createContext<PaneSurface>('$backgroundPrimary')

export const PaneSurfaceProvider = PaneSurfaceContext.Provider

export function usePaneSurface(): PaneSurface {
  return useContext(PaneSurfaceContext)
}
