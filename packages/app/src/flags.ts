import { requirePorts } from './ports'

/**
 * Feature flags, and the environment variables that override them.
 *
 * Two halves on purpose: the **defaults** live here so every platform agrees what a flag means,
 * and the **override** is a port, because the three platforms expose the environment differently.
 *
 * Every flag is overridable on all three. A flag that can only be flipped by editing source cannot
 * be used to bisect a bug on somebody else's device, which is most of what a flag is for. One that
 * genuinely cannot be has to say why here.
 */

export const FLAGS = {
  /**
   * Offer a choice of recovery-phrase length rather than only the legacy one.
   *
   * Off by default because a longer phrase is not restorable by older clients, so somebody who
   * picks one and later restores on a legacy build has an account they cannot reach.
   */
  recoveryPhraseLength: false,

  /**
   * Offer a choice of language for the recovery phrase, independent of the app's language.
   *
   * Separate from `recoveryPhraseLength` because a phrase in another language is the same entropy
   * and restores anywhere with the wordlist, where a longer one is a compatibility break.
   */
  recoveryPhraseLanguage: false,

  /**
   * Offer the language control during onboarding, before an account exists.
   *
   * On by default. The mobile branch hands over to the OS's own per-app language screen, which
   * exists only once a build declares its localizations -- which they now do.
   */
  onboardingLanguageSelect: true,

  /**
   * **Force** the tablet's onboarding on any wide window, rather than only where the OS suspends
   * the app.
   *
   * Named for the forcing, because this is not the switch that decides the design: that is the
   * window's width and the notifications port, and this overrides only the second.
   *
   * A tablet is the desktop layout plus the notification-mode step, and which a build gets is an
   * OS fact rather than a window size. Correct, and it makes the tablet flow unreachable on a
   * desktop -- so the one design nobody can open is the hardest to check. Off by default, since it
   * changes which screens appear.
   */
  forceOnboardingTabletDesign: false,

  /**
   * **Force** fast notifications to look available, whatever the build can actually do.
   *
   * Availability is a fact about the build -- a direct-download Android has no Play Services -- so
   * the "Recommended" state is unreachable on the machines it is developed on. Changes only what
   * the screen says about the option, never what a notification does.
   */
  forceFastModeAvailable: false,

  /**
   * Turn off every animation and transition.
   *
   * For automated tests, which otherwise race whatever is still moving: a screenshot mid-transition
   * differs each run, and a tap aimed at a control that has not settled misses.
   */
  disableAnimations: false,
} as const

export type FlagName = keyof typeof FLAGS

/**
 * The environment variable a flag reads, derived rather than listed.
 *
 * `recoveryPhraseLength` becomes `SESSION_FLAG_RECOVERY_PHRASE_LENGTH`, so a new flag cannot
 * arrive with its variable misspelled, absent, or shared with another flag.
 */
export function envVarFor(flag: FlagName): string {
  const screamed = flag.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
  return `SESSION_FLAG_${screamed}`
}

/**
 * Anything that is unambiguously a person typing "on".
 *
 * Deliberately narrow: an unset variable, an empty one or a typo all fall through to the default
 * rather than silently enabling something.
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
 * Reads the port every call rather than caching, because on mobile the value is live. The lookup
 * is a map read and a string compare, so there is nothing to save by holding it.
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
