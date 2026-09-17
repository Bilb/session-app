import { afterEach, describe, expect, it } from 'vitest'

import { FLAGS, envVarFor, flag, flagSnapshot } from '../src/flags'
import { memoryPorts, resetPorts, setPorts } from '../src'
import type { FlagName } from '../src/flags'

/** Installs ports whose only override is the one under test. */
function withEnv(env: Record<string, string>): void {
  setPorts(memoryPorts({ flags: { override: (name) => env[name] ?? null } }))
}

afterEach(() => {
  resetPorts()
})

describe('feature flags', () => {
  it('derives an environment variable name per flag, with no collisions', () => {
    expect(envVarFor('recoveryPhraseLong')).toBe('EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LONG')
    const names = (Object.keys(FLAGS) as FlagName[]).map(envVarFor)
    expect(new Set(names).size).toBe(names.length)
  })

  it('falls back to the default when nothing is set', () => {
    withEnv({})
    expect(flag('recoveryPhraseLong')).toBe(FLAGS.recoveryPhraseLong)
  })

  it('turns on for anything that is unambiguously a person typing yes', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', ' on ']) {
      withEnv({ EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LONG: value })
      expect(flag('recoveryPhraseLong'), value).toBe(true)
    }
  })

  it('turns off explicitly, so a flag defaulting on can be disabled', () => {
    withEnv({ EXPO_PUBLIC_SESSION_FLAG_ONBOARDING_LANGUAGE_SELECT: 'false' })
    expect(flag('onboardingLanguageSelect')).toBe(false)
  })

  it('ignores a value it does not understand rather than guessing', () => {
    // The asymmetry is deliberate: a variable set by accident, or misspelled, must not enable
    // something. Falling through to the default is the safe direction.
    for (const value of ['', '  ', 'maybe', 'ON!', '2']) {
      withEnv({ EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LONG: value })
      expect(flag('recoveryPhraseLong'), JSON.stringify(value)).toBe(false)
    }
  })

  it('reports every flag at once, for a bug report to quote', () => {
    withEnv({ EXPO_PUBLIC_SESSION_FLAG_RECOVERY_PHRASE_LONG: '1' })
    const snapshot = flagSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(FLAGS).sort())
    expect(snapshot.recoveryPhraseLong).toBe(true)
    expect(snapshot.recoveryPhraseLanguage).toBe(FLAGS.recoveryPhraseLanguage)
  })
})
