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
    expect(envVarFor('recoveryPhraseLength')).toBe('SESSION_FLAG_RECOVERY_PHRASE_LENGTH')
    const names = (Object.keys(FLAGS) as FlagName[]).map(envVarFor)
    expect(new Set(names).size).toBe(names.length)
  })

  it('falls back to the default when nothing is set', () => {
    withEnv({})
    expect(flag('recoveryPhraseLength')).toBe(FLAGS.recoveryPhraseLength)
  })

  it('turns on for anything that is unambiguously a person typing yes', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', ' on ']) {
      withEnv({ SESSION_FLAG_RECOVERY_PHRASE_LENGTH: value })
      expect(flag('recoveryPhraseLength'), value).toBe(true)
    }
  })

  it('turns off explicitly, so a flag defaulting on can be disabled', () => {
    withEnv({ SESSION_FLAG_ONBOARDING_LANGUAGE_SELECT: 'false' })
    expect(flag('onboardingLanguageSelect')).toBe(false)
  })

  it('ignores a value it does not understand rather than guessing', () => {
    // The asymmetry is deliberate: a variable set by accident, or misspelled, must not enable
    // something. Falling through to the default is the safe direction.
    for (const value of ['', '  ', 'maybe', 'ON!', '2']) {
      withEnv({ SESSION_FLAG_RECOVERY_PHRASE_LENGTH: value })
      expect(flag('recoveryPhraseLength'), JSON.stringify(value)).toBe(false)
    }
  })

  it('reports every flag at once, for a bug report to quote', () => {
    withEnv({ SESSION_FLAG_RECOVERY_PHRASE_LENGTH: '1' })
    const snapshot = flagSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(FLAGS).sort())
    expect(snapshot.recoveryPhraseLength).toBe(true)
    expect(snapshot.recoveryPhraseLanguage).toBe(FLAGS.recoveryPhraseLanguage)
  })
})
