/**
 * The content panel's metrics, from the desktop client's `SessionWrapperModal`. Separate from
 * `Modal`'s alert metrics: at an alert's 360 width a settings row cannot fit a label and a value.
 */

/**
 * Fixed widths, not ceilings: the client sets `min-width` and `max-width` to the same value, so the
 * panel does not change width as screens are pushed.
 */
export const PANEL_WIDTH = {
  narrow: 350,
  normal: 420,
  wide: 500,
} as const

export type PanelWidth = keyof typeof PANEL_WIDTH

/** The panel's inset from the top and bottom of the window, as a share of its height: `5vh`. */
export const PANEL_INSET_RATIO = 0.05

/** The client's shadow blur per theme; the colour is the theme's `shadow` role. */
export const PANEL_SHADOW_BLUR = { dark: 34, light: 40 } as const

/** The client's corner radius, which is not on our radius ladder. */
export const PANEL_RADIUS = 13

/** The header height, sized for a control rather than for the title. */
export const HEADER_HEIGHT = 56

/** A footer action's height, from the client's alert, independent of its label. */
export const ACTION_HEIGHT = 51
