import { RADIUS_SCALE, SIZE_SCALE } from './scales'

/**
 * The content panel's metrics. Separate from `Modal`'s alert metrics: at an alert's 360 width a
 * settings row cannot fit a label and a value.
 */

/** Fixed widths, not ceilings, so the panel does not change width as screens are pushed. */
export const PANEL_WIDTH = {
  narrow: 350,
  normal: 420,
  wide: 500,
} as const

export type PanelWidth = keyof typeof PANEL_WIDTH

/** The panel's inset from the top and bottom of the window, as a share of its height: `5vh`. */
export const PANEL_INSET_RATIO = 0.05

/** Shadow blur per theme; the colour is the theme's `shadow` role. */
export const PANEL_SHADOW_BLUR = { dark: 34, light: 40 } as const

export const PANEL_RADIUS = RADIUS_SCALE.md

/** The header height, sized for a control rather than for the title. */
export const HEADER_HEIGHT = SIZE_SCALE['4xl']

/** A footer action's height, independent of its label. */
export const ACTION_HEIGHT = SIZE_SCALE['3xl']
