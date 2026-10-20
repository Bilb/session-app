import { requirePorts } from './ports'

/**
 * The theme this run draws in, over the account's stored choice and never written back: one of
 * `ThemeState`'s names, such as `ocean-light`. `ACCENT_OVERRIDE_VARIABLE` names an accent alike.
 *
 * For tests that look at every theme without driving the settings, and for bisecting a bug that
 * shows in one theme on a device whose settings are out of reach. Desktop reads it at launch, so
 * a change there is a relaunch; on a phone Metro inlines it, so a change is a new bundle.
 */
export const THEME_OVERRIDE_VARIABLE = 'EXPO_PUBLIC_SESSION_THEME'
export const ACCENT_OVERRIDE_VARIABLE = 'EXPO_PUBLIC_SESSION_ACCENT'

/** What the desktop main process reads at launch and hands the renderer. */
export const APPEARANCE_OVERRIDE_VARIABLES = [
  THEME_OVERRIDE_VARIABLE,
  ACCENT_OVERRIDE_VARIABLE,
] as const

/** The raw names, unchecked: `appearanceFrom` in `@session/ui` ignores one it does not ship. */
export function appearanceOverride(): { theme: string | null; accent: string | null } {
  const { flags } = requirePorts()
  return {
    theme: flags.override(THEME_OVERRIDE_VARIABLE),
    accent: flags.override(ACCENT_OVERRIDE_VARIABLE),
  }
}
