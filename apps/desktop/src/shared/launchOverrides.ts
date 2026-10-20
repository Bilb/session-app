import { APPEARANCE_OVERRIDE_VARIABLES } from '@session/app/appearanceOverride'

/**
 * The overrides read at launch rather than substituted at build time, carried from main to the
 * page as a command-line switch on the renderer's process: the page has no environment, and the
 * preload has `process.argv` before the page runs.
 */
const SWITCH = '--session-launch-overrides='

const CARRIED: readonly string[] = APPEARANCE_OVERRIDE_VARIABLES

/** The switch for main to append, carrying each override set and non-empty in `env`. */
export function launchOverridesSwitch(env: Readonly<Record<string, string | undefined>>): string {
  const set = CARRIED.flatMap((name) => {
    const value = env[name]
    return value === undefined || value === '' ? [] : [[name, value] as const]
  })
  return `${SWITCH}${JSON.stringify(Object.fromEntries(set))}`
}

/** What the switch carried, keeping only strings under names main carries. */
export function readLaunchOverrides(argv: readonly string[]): Record<string, string> {
  const carried = argv.find((arg) => arg.startsWith(SWITCH))
  if (carried === undefined) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(carried.slice(SWITCH.length))
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null) return {}
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        CARRIED.includes(entry[0]) && typeof entry[1] === 'string',
    ),
  )
}
