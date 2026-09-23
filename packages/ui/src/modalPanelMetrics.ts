/**
 * The content modal's own metrics, from the desktop client's `SessionWrapperModal`.
 *
 * Apart from `Modal`'s, which are an alert's: an alert is a paragraph and two buttons, measured
 * against its text, where this holds a list of rows and the screens they lead to. The two being
 * different components with different numbers is the point -- a settings tree drawn at an alert's
 * 360 width and 35 inset has rows too narrow to carry a label and a value.
 */

/**
 * The three widths the client offers, and the fourth it does not.
 *
 * **Each is a fixed width rather than a ceiling**: the client sets `min-width` and `max-width` to
 * the same value, so a settings page and the confirmation over it are exactly as wide as each
 * other however much either holds. A panel sized to its content changes width as a screen is
 * pushed, which reads as the whole dialog having moved.
 */
export const PANEL_WIDTH = {
  narrow: 350,
  normal: 420,
  wide: 500,
} as const

export type PanelWidth = keyof typeof PANEL_WIDTH

/**
 * How far the panel stands off the top and bottom of the window, as a share of its height: the
 * client's `5vh` either side.
 *
 * Short of the full height on purpose -- a panel reaching both edges of the window has stopped
 * reading as something over the page and started reading as the page. What is left is what says
 * the page is still behind it.
 */
export const PANEL_INSET_RATIO = 0.05

/**
 * The shadow's blur, from the client: tighter where the shadow is opaque black on a dark theme than
 * where it is a quarter-strength one on a light theme. Its colour is the theme's `shadow` role.
 */
export const PANEL_SHADOW_BLUR = { dark: 34, light: 40 } as const

/** The client's own corner, which is not on our radius ladder and is written as itself. */
export const PANEL_RADIUS = 13

/** The header's own height, tall enough for a control rather than for its title. */
export const HEADER_HEIGHT = 56

/**
 * How tall a footer action is, from the client's alert.
 *
 * A control's height rather than its label's: the actions run the full width of the panel and
 * share an edge, so each cell is as tall as a control whatever its text.
 */
export const ACTION_HEIGHT = 51
