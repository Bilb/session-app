import { envVarFor, FLAGS, type FlagName } from '@session/app'

/**
 * The flag overrides this build was started with.
 *
 * **Every variable is named literally, and it has to be.** Expo's transform replaces
 * `process.env.EXPO_PUBLIC_X` only where the source spells the name out; a computed lookup -- what
 * a shared `envVarFor(name)` produces -- is left alone, and `process.env` on a device is very
 * nearly empty, so such a flag can never be set on a phone at all.
 *
 * So the names are repeated here once each. One added to the shared table and forgotten here fails
 * `tests/flagOverrides.test.ts` rather than silently ignoring its variable.
 *
 * `EXPO_PUBLIC_` is the prefix because that is the only one Expo carries into a bundle. Desktop
 * reads the same variable without it.
 */
const OVERRIDES: Record<string, string | undefined> = {
  SESSION_FLAG_RECOVERY_PHRASE_LENGTH: process.env.EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LENGTH,
  SESSION_FLAG_RECOVERY_PHRASE_LANGUAGE:
    process.env.EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LANGUAGE,
  SESSION_FLAG_ONBOARDING_LANGUAGE_SELECT:
    process.env.EXPO_PUBLIC_SESSION_FLAG_ONBOARDING_LANGUAGE_SELECT,
  SESSION_FLAG_FORCE_ONBOARDING_TABLET_DESIGN:
    process.env.EXPO_PUBLIC_SESSION_FLAG_FORCE_ONBOARDING_TABLET_DESIGN,
  SESSION_FLAG_FORCE_FAST_MODE_AVAILABLE:
    process.env.EXPO_PUBLIC_SESSION_FLAG_FORCE_FAST_MODE_AVAILABLE,
  SESSION_FLAG_DISABLE_ANIMATIONS: process.env.EXPO_PUBLIC_SESSION_FLAG_DISABLE_ANIMATIONS,
}

/** What the flags port hands back: the override, or nothing set. */
export function flagOverride(name: string): string | null {
  return OVERRIDES[name] ?? null
}

/** The variables this file covers, for the test that says it covers all of them. */
export function overriddenVariables(): string[] {
  return Object.keys(OVERRIDES)
}

/** Every variable the shared table expects a mobile build to read. */
export function expectedVariables(): string[] {
  return (Object.keys(FLAGS) as FlagName[]).map(envVarFor)
}
