// All values are plain numbers (no CSS units) so they work on both web and React Native.

export const FONT_SIZE = {
  h1: 30,
  h1New: 36,
  h2: 24,
  h2New: 32,
  h3: 20,
  h3New: 29,
  h4: 26,
  h5: 23,
  h6: 20,
  h7: 18,
  h8: 16,
  h9: 14,
  xl: 19,
  lg: 17,
  md: 15,
  sm: 13,
  xs: 11,
  xxs: 9,
  displayXl: 18,
  displayLg: 16,
  displayMd: 14,
} as const

export const LINE_HEIGHT = 1.2

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
