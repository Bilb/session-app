import { describe, expect, it } from 'vitest'

import { absentSubmodules, turboTasksIn } from '#src/ci'

const WORKFLOW = `
      - run: git submodule update --init --recursive packages/localization/src/localization-src
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm boundaries
      - run: pnpm typecheck
      - run: pnpm codegen:check
`

describe('turboTasksIn', () => {
  it('follows each pnpm step to the turbo tasks it starts, and skips the ones that are not turbo', () => {
    const scripts = {
      lint: 'turbo lint',
      boundaries: 'depcruise --config x',
      typecheck: 'turbo run typecheck',
      'codegen:check': 'turbo codegen:check',
    }
    expect(turboTasksIn(WORKFLOW, scripts)).toEqual(['lint', 'typecheck', 'codegen:check'])
  })
})

describe('absentSubmodules', () => {
  it('is every submodule the workflow does not initialise', () => {
    const gitmodules = `
[submodule "libsession-util"]
	path = libsession-util
[submodule "localization"]
	path = packages/localization/src/localization-src
`
    expect(absentSubmodules(gitmodules, WORKFLOW)).toEqual(['libsession-util'])
  })
})
