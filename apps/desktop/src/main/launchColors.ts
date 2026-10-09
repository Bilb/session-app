import { DEFAULT_ACCENT, DEFAULT_THEME, getThemeTokens } from '@session/theme-tokens'

/**
 * What the launch screen is drawn in: the default theme, because the account's choice is in
 * libsession's database, which is not open yet.
 *
 * Shared by the window's own background, which shows before the page has loaded anything, and the
 * page's launch screen, which shows until the app draws -- so the two are the same colour and the
 * hand-over between them is invisible. The app's own starting screen is drawn in the same theme,
 * for the same reason.
 */
export function launchColors(): { background: string; mark: string } {
  const tokens = getThemeTokens(DEFAULT_THEME, DEFAULT_ACCENT)
  return { background: tokens.backgroundPrimary, mark: tokens.primaryColor }
}
