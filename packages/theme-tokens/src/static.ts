// All values are plain numbers (no CSS units) so they work on both web and React Native.

/**
 * One type ramp, named by role in four groups: label, body, header, display.
 *
 * Names rather than positions because a layout has to be readable -- `size="$8"` says nothing about
 * what it is for, and neither does the diff when it changes.
 *
 * **One ramp, one entry per size, ascending.** Names invite a second ramp to be added beside the
 * first and the overlap suffixed, which produces a scale that goes backwards somewhere in the
 * middle and repeats elsewhere -- and nothing catches it, because every name still resolves. A
 * named ramp is fine; a named ramp per source is not.
 *
 * The values are iOS's `Fonts.swift` ramp and Android's typography, which agree with each other and
 * with the newest designs. **iOS has two live ramps**, and this is the newer one: `Values.swift`
 * carries a different scale entirely, so a size read out of iOS means nothing until the file it
 * came from is known.
 *
 * **11 is the floor.** Both mobile clients declare a 9 below it and neither draws anything at it;
 * Desktop's theme records that below 14 is unreadable on that platform.
 */
export const FONT_SIZE = {
  caption: 11,
  label: 12,
  body: 14,
  bodyLarge: 16,
  title: 18,
  titleLarge: 20,
  heading: 23,
  headingLarge: 26,
  display: 29,
  displayMedium: 32,
  displayLarge: 36,
} as const

/**
 * Line height derived rather than declared, at 1.2x the size.
 *
 * Android derives it at exactly this ratio on every entry and is the only place either legacy
 * client derives anything about type; iOS declares no line height at all, anywhere. A ratio also
 * means a size added to the ramp cannot arrive without one.
 */
export const LINE_HEIGHT_RATIO = 1.2

// Spacing values in logical pixels (no units).
export const SPACING = {
  '3xl': 35,
  '2xl': 30,
  xl: 25,
  lg: 20,
  md: 15,
  sm: 10,
  xs: 5,
  xxs: 2.5,
} as const

export const RADII = {
  sm: 5,
  message: 16,
} as const

// All durations in milliseconds.
export const DURATION = {
  default: 250,
  messageHighlight: 1000,
  typingAnimation: 1600,
  sessionSpinner: 600,
  spinner: 3000,
  pulse: 1000,
  rightPanel: 300,
  progressBar: 500,
  fadein: 1000,
  modalToInbox: 100,
} as const

// Desktop-specific layout constants - not applicable in React Native.
export const LAYOUT = {
  desktop: {
    leftPanelWidth: 380,
    actionsPanelWidth: 80,
    mainViewHeaderHeight: 68,
    compositionContainerHeight: 60,
    searchInputHeight: 34,
    panelButtonContainerMinHeight: 70,
    userSettingsIconMinWidth: 50,
    rightPanelWidth: 420,
    contactRowHeight: 60,
    contactRowBreakHeight: 20,
  },
} as const
