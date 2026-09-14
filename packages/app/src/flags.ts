import { requirePorts } from './ports'

/**
 * Feature flags, and the environment variables that override them.
 *
 * Two halves on purpose. The **defaults** live here, shared, so every platform agrees what a flag
 * means and a test can read the table. The **override** is a port, because the three platforms
 * expose the environment differently and nothing else in shared code should know that.
 *
 * Every flag is overridable on all three platforms. A flag that can only be flipped by editing
 * source cannot be used to bisect a bug on somebody else's device, which is most of what a flag is
 * for. If a flag ever genuinely cannot be overridden, its comment here has to say why.
 */

export const FLAGS = {
  /**
   * Offer a choice of recovery-phrase length rather than only the legacy one.
   *
   * Off by default because a longer phrase is not restorable by older clients: a person who picks
   * one and later restores on a legacy build has an account they cannot reach. The flag exists so
   * the screens can be built and exercised before that story is settled.
   */
  recoveryPhraseLength: false,

  /**
   * Offer a choice of language for the recovery phrase, independent of the app's language.
   *
   * Separate from `recoveryPhraseLength` because the two have different blast radii: a phrase in
   * another language is still the same entropy and restores anywhere that has the wordlist, where
   * a longer phrase is a compatibility break. Gated separately so one can ship without the other.
   */
  recoveryPhraseLanguage: false,

  /**
   * Offer the language control during onboarding, before an account exists.
   *
   * On by default since 2026-09-14. It was off while the control had nowhere to send a phone: the
   * mobile branch hands over to the OS's own per-app language screen, and until the builds declared
   * their localizations there was no such screen to hand over to. Both halves exist now.
   */
  onboardingLanguageSelect: true,

  /**
   * **Force** the tablet's onboarding on any wide window, rather than only where the OS suspends
   * the app.
   *
   * Named for the forcing rather than for the design, because the unprefixed name read as though it
   * were the switch that decides which design is used. It is not: the design is decided by the
   * window's width and the notifications port, and this only overrides the second of those.
   *
   * A tablet is the desktop layout plus the notification-mode step, and which of those two a build
   * gets is decided by the notifications port -- an OS fact, not a window size. That is correct and
   * it makes the tablet flow unreachable on a desktop, so the one design nobody can open is the one
   * hardest to check. This flag makes a desktop window answer the way a tablet does.
   *
   * Off by default. It changes which screens appear, so it is a thing to look at deliberately
   * rather than something to leave on.
   */
  forceOnboardingTabletDesign: false,
} as const

export type FlagName = keyof typeof FLAGS

/**
 * The environment variable a flag reads, derived rather than listed.
 *
 * `recoveryPhraseLength` becomes `SESSION_FLAG_RECOVERY_PHRASE_LENGTH`. Deriving it means a new
 * flag cannot arrive with its variable name misspelled, or absent, or accidentally shared with
 * another flag.
 */
export function envVarFor(flag: FlagName): string {
  const screamed = flag.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
  return `SESSION_FLAG_${screamed}`
}

/**
 * Anything that is unambiguously a person typing "on".
 *
 * Deliberately narrow: an unset variable, an empty one, or a typo all fall through to the default
 * rather than silently enabling something. The asymmetry is the point -- a flag set by accident
 * should stay off.
 */
function truthy(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function falsy(value: string): boolean {
  return ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

/**
 * Whether a flag is on, after any environment override.
 *
 * Reads the port every call rather than caching. On mobile the value is live, so a cached answer
 * would outlive the reason for it; on desktop it is substituted at build time today, which is a
 * limitation of the renderer rather than of this. The lookup is a map read and a string compare,
 * so there is nothing to save either way.
 */
export function flag(name: FlagName): boolean {
  const override = requirePorts().flags.override(envVarFor(name))
  if (override === null) return FLAGS[name]
  if (truthy(override)) return true
  if (falsy(override)) return false
  return FLAGS[name]
}

/** Every flag and its effective value. For the debug menu, and for a bug report to quote. */
export function flagSnapshot(): Record<FlagName, boolean> {
  const names = Object.keys(FLAGS) as FlagName[]
  return Object.fromEntries(names.map((n) => [n, flag(n)])) as Record<FlagName, boolean>
}
