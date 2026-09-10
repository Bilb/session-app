// All values are plain numbers (no CSS units) so they work on both web and React Native.

/**
 * One type ramp, named by role in four groups: label, body, header, display.
 *
 * Names rather than positions because a layout has to be readable -- `size="$8"` says nothing about
 * what it is for, and neither does the diff when it changes. The names are the *only* thing that
 * changed from the numbered version, though: it is still one ramp with one entry per size, which
 * is what the previous naming got wrong. Three ramps had been spliced together and the overlap
 * suffixed `New`, so the consumed scale ran 9, 11, 13, 15, 17, 19, 18, 20, 20, 24, 30 -- backwards
 * at one position and repeated at two more. A named ramp is fine; a named ramp per source is not.
 *
 * The values are the ramp both legacy clients already share (iOS `Fonts.swift`, Android's
 * typography), which is the one the designs were drawn against.
 */
export const FONT_SIZE = {
  micro: 9,
  caption: 11,
  label: 12,
  body: 14,
  bodyLarge: 16,
  title: 18,
  titleLarge: 20,
  heading: 23,
  headingLarge: 26,
  display: 29,
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
