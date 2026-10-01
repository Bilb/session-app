import { describe, expect, it } from 'vitest'

import { CHECKS, commandsFor, type Check } from '#src/checks'

const SAMPLE: Check[] = [
  { run: 'install --frozen-lockfile', stage: 'ci-only', because: 'setup' },
  { run: 'format:check', stage: 'pre-commit' },
  { run: 'dedupe --check', stage: 'pre-commit', when: /^pnpm-lock\.yaml$/ },
  { run: 'test', stage: 'pre-push', perPackage: true },
  { run: 'knip', stage: 'pre-push' },
]

describe('commandsFor', () => {
  it('runs a stage its own checks, and never a CI-only one', () => {
    expect(commandsFor(SAMPLE, 'pre-commit', ['a.ts'], null)).toEqual([['format:check']])
  })

  it('runs a conditional check only when a file it cares about changed', () => {
    expect(commandsFor(SAMPLE, 'pre-commit', ['pnpm-lock.yaml'], null)).toEqual([
      ['format:check'],
      ['dedupe', '--check'],
    ])
  })

  it('narrows a per-package check to the packages changed since the base', () => {
    expect(commandsFor(SAMPLE, 'pre-push', [], 'abc123')).toEqual([
      ['test', '--filter=...[abc123]'],
      ['knip'],
    ])
  })

  it('runs a per-package check everywhere when there is no base', () => {
    expect(commandsFor(SAMPLE, 'pre-push', [], null)).toEqual([['test'], ['knip']])
  })
})

describe('the checks', () => {
  it('give every CI-only check its reason', () => {
    for (const check of CHECKS)
      if (check.stage === 'ci-only') expect(check.because.trim()).not.toBe('')
  })

  it('run boundaries for a staged source file and codegen only for bridge-types', () => {
    const runs = (file: string) =>
      commandsFor(CHECKS, 'pre-commit', [file], null).map((args) => args.join(' '))
    expect(runs('packages/ui/src/Button.tsx')).toContain('boundaries')
    expect(runs('packages/ui/src/Button.tsx')).not.toContain('codegen:check')
    expect(runs('packages/bridge-types/src/x.ts')).toContain('codegen:check')
  })

  it('run lint:manifests for every file turbo-guard reads, not only manifests', () => {
    for (const file of ['turbo.json', '.gitmodules', 'packages/ui/src/Button.tsx'])
      expect(commandsFor(CHECKS, 'pre-commit', [file], null).map((args) => args[0])).toContain(
        'lint:manifests',
      )
  })
})
