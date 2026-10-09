import type { PrimaryColorState, ThemeState } from './colors'

/**
 * The theme a device with no stored choice is drawn in, and everything drawn before the choice can
 * be read: the launch screen on every platform.
 *
 * Here rather than with the UI's themes so the desktop main process, which cannot load the UI, can
 * colour its window to match.
 */
export const DEFAULT_THEME: ThemeState = 'classic-dark'
export const DEFAULT_ACCENT: PrimaryColorState = 'green'
