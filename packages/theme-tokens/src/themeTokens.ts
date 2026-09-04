import { COLORS, PRIMARY_COLOR_HEX, THEMES } from './colors'
import type { PrimaryColorState, ThemeState } from './colors'
import { hexColorToRGB } from './hexColorToRGB'

type ThemeKey = 'classicDark' | 'classicLight' | 'oceanDark' | 'oceanLight'

const themeStateToKey: Record<ThemeState, ThemeKey> = {
  'classic-dark': 'classicDark',
  'classic-light': 'classicLight',
  'ocean-dark': 'oceanDark',
  'ocean-light': 'oceanLight',
}

export type ThemeTokens = {
  // Accent
  primaryColor: string
  // Semantic
  dangerColor: string
  warningColor: string
  disabledColor: string
  // Backgrounds
  backgroundPrimary: string
  backgroundSecondary: string
  backgroundTertiary: string
  // Text
  textPrimary: string
  textSecondary: string
  textSelection: string
  // Borders
  bordersColor: string
  // Message bubbles
  messageBubbleOutgoingBg: string
  messageBubbleIncomingBg: string
  messageBubbleOutgoingText: string
  messageBubbleIncomingText: string
  // Menu buttons
  menuButtonBgHover: string
  menuButtonIcon: string
  menuButtonIconHover: string
  menuButtonBorder: string
  menuButtonBorderHover: string
  // Chat buttons
  chatButtonsBg: string
  chatButtonsBgHover: string
  chatButtonsIcon: string
  // Outline buttons
  buttonOutlineBg: string
  buttonOutlineBgHover: string
  buttonOutlineText: string
  buttonOutlineTextHover: string
  buttonOutlineBorder: string
  buttonOutlineBorderHover: string
  // Solid buttons
  buttonSolidBgHover: string
  buttonSolidTextHover: string
  // Simple buttons
  buttonSimpleText: string
  // Icon buttons
  buttonIconBg: string
  buttonIconStrokeHover: string
  buttonIconStrokeSelected: string
  // Accent icons
  accentIconBg: string
  accentIconFill: string
  // Conversation tabs
  conversationTabBg: string
  conversationTabBgHover: string
  conversationTabBgSelected: string
  conversationTabBgUnread: string
  conversationTabTextSelected: string
  conversationTabTextUnread: string
  // Search bar
  searchBarBg: string
  // Scroll bars
  scrollBarTrack: string
  scrollBarTrackHover: string
  scrollBarThumb: string
  scrollBarThumbHover: string
  // Toggle switch
  toggleSwitchBallShadow: string
  toggleSwitchOffBorder: string
  // Emoji reaction bar
  emojiReactionBarBg: string
  emojiReactionBarIconBg: string
  // Modals
  modalBg: string
  modalBgContent: string
  modalShadow: string
  modalDropShadow: string
  buttonDropShadow: string
  // Toast
  toastBg: string
  // Session logo filter (CSS filter string - web-only, ignored on RN)
  sessionLogoTextFilter: string
  // Suggestions / mentions
  suggestionsBg: string
  suggestionsBgHover: string
  // Input
  inputText: string
  // Call buttons
  callButtonsBg: string
  callButtonsBgHover: string
  callButtonsBgDisabled: string
  callButtonsActionBg: string
  callButtonsActionBgHover: string
  callButtonsIcon: string
  callButtonsIconDisabled: string
  // File drop zone
  fileDropzoneBorder: string
  // Session recording pulse - returned as "r, g, b" for use in rgba()
  sessionRecordingPulse: string
  // HTML renderer span
  rendererSpanPrimary: string
}

export function getThemeTokens(theme: ThemeState, primaryColor: PrimaryColorState): ThemeTokens {
  const tk = themeStateToKey[theme]
  const isDark = tk === 'classicDark' || tk === 'oceanDark'
  const isClassic = tk === 'classicDark' || tk === 'classicLight'

  const TCD = THEMES.CLASSIC_DARK
  const TCL = THEMES.CLASSIC_LIGHT
  const TOD = THEMES.OCEAN_DARK
  const TOL = THEMES.OCEAN_LIGHT

  const primary = PRIMARY_COLOR_HEX[primaryColor]

  // --- Base tokens (resolved directly from THEMES palettes) ---

  const backgroundPrimary =
    tk === 'classicDark'
      ? TCD.COLOR1
      : tk === 'classicLight'
        ? TCL.COLOR6
        : tk === 'oceanDark'
          ? TOD.COLOR1
          : TOL.COLOR7

  const backgroundSecondary =
    tk === 'classicDark'
      ? TCD.COLOR0
      : tk === 'classicLight'
        ? TCL.COLOR5
        : tk === 'oceanDark'
          ? TOD.COLOR2
          : TOL.COLOR6

  const backgroundTertiary =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR3
          : TOL.COLOR5

  const textPrimary =
    tk === 'classicDark'
      ? TCD.COLOR6
      : tk === 'classicLight'
        ? TCL.COLOR0
        : tk === 'oceanDark'
          ? TOD.COLOR7
          : TOL.COLOR1

  const textSecondary =
    tk === 'classicDark'
      ? TCD.COLOR5
      : tk === 'classicLight'
        ? TCL.COLOR1
        : tk === 'oceanDark'
          ? TOD.COLOR5
          : TOL.COLOR2

  const bordersColor =
    tk === 'classicDark'
      ? TCD.COLOR3
      : tk === 'classicLight'
        ? TCL.COLOR3
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR3

  const dangerColor =
    tk === 'classicDark'
      ? TCD.DANGER
      : tk === 'classicLight'
        ? TCL.DANGER
        : tk === 'oceanDark'
          ? TOD.DANGER
          : TOL.DANGER

  const warningColor =
    tk === 'classicDark'
      ? TCD.WARNING
      : tk === 'classicLight'
        ? TCL.WARNING
        : tk === 'oceanDark'
          ? TOD.WARNING
          : TOL.WARNING

  const disabledColor =
    tk === 'classicDark'
      ? TCD.DISABLED
      : tk === 'classicLight'
        ? TCL.DISABLED
        : tk === 'oceanDark'
          ? TOD.DISABLED
          : TOL.DISABLED

  // --- Derived tokens ---

  const textSelection = `rgba(${hexColorToRGB(textPrimary)}, 0.5)`

  const modalShadow = isDark
    ? `rgba(${hexColorToRGB(COLORS.BLACK)}, 1.0)`
    : `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.25)`

  const messageBubbleOutgoingBg = primary

  const messageBubbleIncomingBg =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR4

  const messageBubbleOutgoingText = !isDark
    ? textPrimary
    : tk === 'classicDark'
      ? backgroundPrimary
      : COLORS.BLACK

  const messageBubbleIncomingText = textPrimary

  const menuButtonBgHover = isDark ? primary : textPrimary
  const menuButtonIcon = isDark ? primary : textPrimary
  const menuButtonIconHover = isDark
    ? textPrimary
    : tk === 'classicLight'
      ? COLORS.WHITE
      : TOL.COLOR5
  const menuButtonBorder = isDark ? primary : textPrimary
  const menuButtonBorderHover = isDark ? primary : textPrimary

  const chatButtonsBg =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR2
          : TOL.COLOR5

  const chatButtonsBgHover =
    tk === 'classicDark'
      ? TCD.COLOR3
      : tk === 'classicLight'
        ? TCL.COLOR3
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR3

  const chatButtonsIcon = tk === 'oceanDark' ? TOD.COLOR7 : textPrimary

  const buttonOutlineBg = COLORS.TRANSPARENT
  const buttonOutlineBgHover = textPrimary
  const buttonOutlineText = textPrimary
  const buttonOutlineTextHover =
    tk === 'classicDark'
      ? COLORS.BLACK
      : tk === 'classicLight'
        ? TCL.COLOR6
        : tk === 'oceanDark'
          ? TOD.COLOR1
          : TOL.COLOR7
  const buttonOutlineBorder = textPrimary
  const buttonOutlineBorderHover = textPrimary

  const buttonSolidBgHover = COLORS.TRANSPARENT
  const buttonSolidTextHover = textPrimary
  const buttonSimpleText = textPrimary
  const buttonIconBg = COLORS.TRANSPARENT
  const buttonIconStrokeHover = textPrimary
  const buttonIconStrokeSelected = textPrimary

  // color-mix(in srgb, primary 10%, transparent) → rgba(r, g, b, 0.1)
  const accentIconBg = tk === 'classicLight' ? COLORS.WHITE : `rgba(${hexColorToRGB(primary)}, 0.1)`
  const accentIconFill = isDark ? primary : textPrimary

  const conversationTabBg = tk === 'classicLight' ? COLORS.WHITE : backgroundPrimary
  const conversationTabBgHover =
    tk === 'classicDark'
      ? TCD.COLOR3
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR3
          : TOL.COLOR5
  const conversationTabBgSelected = conversationTabBgHover
  const conversationTabBgUnread =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? backgroundPrimary
        : tk === 'oceanDark'
          ? TOD.COLOR2
          : backgroundSecondary
  const conversationTabTextSelected = textPrimary
  const conversationTabTextUnread = textPrimary

  const searchBarBg = isClassic ? backgroundSecondary : tk === 'oceanDark' ? TOD.COLOR3 : TOL.COLOR5

  const scrollBaseColor =
    tk === 'classicDark'
      ? TCD.COLOR5
      : tk === 'classicLight'
        ? TCL.COLOR1
        : tk === 'oceanDark'
          ? TOD.COLOR5
          : TOL.COLOR2
  const scrollBarTrack = `rgba(${hexColorToRGB(scrollBaseColor)}, 0.10)`
  const scrollBarTrackHover = `rgba(${hexColorToRGB(scrollBaseColor)}, 0.20)`
  const scrollBarThumb = `rgba(${hexColorToRGB(scrollBaseColor)}, 0.20)`
  const scrollBarThumbHover = `rgba(${hexColorToRGB(scrollBaseColor)}, 1.0)`

  const toggleSwitchBallShadow = `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`
  const toggleSwitchOffBorder = isDark ? COLORS.WHITE : bordersColor

  const emojiReactionBarBg =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? backgroundSecondary
          : backgroundPrimary
  const emojiReactionBarIconBg =
    tk === 'classicDark'
      ? backgroundSecondary
      : tk === 'classicLight'
        ? backgroundPrimary
        : tk === 'oceanDark'
          ? backgroundPrimary
          : backgroundSecondary

  const modalBg = isDark
    ? `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.5)`
    : `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.2)`
  const modalBgContent =
    tk === 'classicDark'
      ? COLORS.NEARBLACK
      : tk === 'classicLight'
        ? TCL.COLOR6
        : tk === 'oceanDark'
          ? backgroundSecondary
          : backgroundPrimary
  const modalDropShadow = isDark
    ? `0px 0px 34px 0px ${modalShadow}`
    : `0px 0px 40px 0px ${modalShadow}`
  const buttonDropShadow = isDark ? 'none' : `0px 1px 12px 0px ${modalShadow}`

  const toastBg = tk === 'oceanDark' ? backgroundSecondary : backgroundPrimary

  const sessionLogoTextFilter = isDark ? 'none' : 'brightness(0) saturate(100%)'

  const suggestionsBg = tk === 'classicDark' ? TCD.COLOR2 : backgroundSecondary
  const suggestionsBgHover =
    tk === 'classicDark'
      ? TCD.COLOR3
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR4

  const inputText = textPrimary

  const callButtonsBg =
    tk === 'classicDark'
      ? TCD.COLOR3
      : tk === 'classicLight'
        ? TCL.COLOR3
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR4
  const callButtonsBgHover =
    tk === 'classicDark'
      ? TCD.COLOR4
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? TOD.COLOR4
          : TOL.COLOR4
  const callButtonsBgDisabled =
    tk === 'classicDark'
      ? TCD.COLOR2
      : tk === 'classicLight'
        ? TCL.COLOR5
        : tk === 'oceanDark'
          ? TOD.COLOR3
          : TOL.COLOR5
  const callButtonsActionBg =
    tk === 'classicDark'
      ? COLORS.WHITE
      : tk === 'classicLight'
        ? TCL.COLOR4
        : tk === 'oceanDark'
          ? COLORS.WHITE
          : TOL.COLOR4
  const callButtonsActionBgHover = isDark
    ? `rgba(${hexColorToRGB(COLORS.WHITE)}, 0.87)`
    : tk === 'classicLight'
      ? TCL.COLOR3
      : TOL.COLOR5
  const callButtonsIcon = tk === 'oceanDark' ? TOD.COLOR7 : textPrimary
  const callButtonsIconDisabled = !isDark
    ? disabledColor
    : tk === 'classicDark'
      ? textPrimary
      : COLORS.WHITE

  const fileDropzoneBorder = isDark ? primary : textPrimary

  // Returned as "r, g, b" for use in rgba() - matches session-desktop convention.
  const sessionRecordingPulse = hexColorToRGB(dangerColor)

  const rendererSpanPrimary = isDark ? primary : textPrimary

  return {
    primaryColor: primary,
    dangerColor,
    warningColor,
    disabledColor,
    backgroundPrimary,
    backgroundSecondary,
    backgroundTertiary,
    textPrimary,
    textSecondary,
    textSelection,
    bordersColor,
    messageBubbleOutgoingBg,
    messageBubbleIncomingBg,
    messageBubbleOutgoingText,
    messageBubbleIncomingText,
    menuButtonBgHover,
    menuButtonIcon,
    menuButtonIconHover,
    menuButtonBorder,
    menuButtonBorderHover,
    chatButtonsBg,
    chatButtonsBgHover,
    chatButtonsIcon,
    buttonOutlineBg,
    buttonOutlineBgHover,
    buttonOutlineText,
    buttonOutlineTextHover,
    buttonOutlineBorder,
    buttonOutlineBorderHover,
    buttonSolidBgHover,
    buttonSolidTextHover,
    buttonSimpleText,
    buttonIconBg,
    buttonIconStrokeHover,
    buttonIconStrokeSelected,
    accentIconBg,
    accentIconFill,
    conversationTabBg,
    conversationTabBgHover,
    conversationTabBgSelected,
    conversationTabBgUnread,
    conversationTabTextSelected,
    conversationTabTextUnread,
    searchBarBg,
    scrollBarTrack,
    scrollBarTrackHover,
    scrollBarThumb,
    scrollBarThumbHover,
    toggleSwitchBallShadow,
    toggleSwitchOffBorder,
    emojiReactionBarBg,
    emojiReactionBarIconBg,
    modalBg,
    modalBgContent,
    modalShadow,
    modalDropShadow,
    buttonDropShadow,
    toastBg,
    sessionLogoTextFilter,
    suggestionsBg,
    suggestionsBgHover,
    inputText,
    callButtonsBg,
    callButtonsBgHover,
    callButtonsBgDisabled,
    callButtonsActionBg,
    callButtonsActionBgHover,
    callButtonsIcon,
    callButtonsIconDisabled,
    fileDropzoneBorder,
    sessionRecordingPulse,
    rendererSpanPrimary,
  }
}
