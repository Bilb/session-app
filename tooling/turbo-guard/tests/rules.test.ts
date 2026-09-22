import { describe, expect, it } from 'vitest'

import { check, fromPackage, missingInCi, type Checkout, type Task } from '#src/rules'

/** CI's checkout, without libsession, with these files committed. */
function checkout(committed: string[] = []): Checkout {
  return {
    absent: ['libsession-util'],
    committed: (glob) => {
      const prefix = glob.endsWith('/**') ? glob.slice(0, -3) : null
      return committed.filter((file) =>
        prefix === null ? file === glob : file.startsWith(`${prefix}/`),
      )
    },
  }
}

function task(overrides: Partial<Task>): Task {
  return {
    id: 'pkg#codegen',
    directory: 'packages/pkg',
    cache: true,
    inputs: [],
    outputs: [],
    ...overrides,
  }
}

const SUBMODULE_INPUT = '../../libsession-util/src/x.cpp'
const TABLE = 'packages/pkg/src/table.generated.ts'

describe('fromPackage', () => {
  it('resolves a package-relative glob against the repo', () => {
    expect(fromPackage('packages/app', SUBMODULE_INPUT)).toBe('libsession-util/src/x.cpp')
  })

  it('leaves out entries that are not paths', () => {
    expect(fromPackage('packages/app', '$TURBO_DEFAULT$')).toBeNull()
    expect(fromPackage('packages/app', '!src/**/*.test.ts')).toBeNull()
  })
})

describe('missingInCi', () => {
  it('is anything under a submodule CI leaves out', () => {
    expect(missingInCi('libsession-util/src/x.cpp', ['libsession-util'])).toBe(true)
    expect(missingInCi('libsession-util', ['libsession-util'])).toBe(true)
  })

  it('is not a sibling that merely shares the prefix', () => {
    expect(missingInCi('libsession-util-extras/x', ['libsession-util'])).toBe(false)
  })
})

describe('check', () => {
  it('passes a cached task whose inputs CI has', () => {
    expect(check([task({ inputs: ['src/**'] })], checkout())).toEqual([])
  })

  it('refuses a cached task with an input CI does not have', () => {
    // The shape that restored a stale URL table: a cached generator keyed on submodule files.
    const violations = check([task({ inputs: [SUBMODULE_INPUT] })], checkout())
    expect(violations.map((v) => v.rule)).toEqual(['absent-input'])
  })

  it('allows an uncached task an input CI does not have', () => {
    expect(check([task({ cache: false, inputs: [SUBMODULE_INPUT] })], checkout())).toEqual([])
  })

  it('refuses a generator with such an input that does not hash its own committed output', () => {
    // The second shape: nothing depending on the generator saw the committed table change.
    const violations = check(
      [task({ cache: false, inputs: [SUBMODULE_INPUT], outputs: ['src/table.generated.ts'] })],
      checkout([TABLE]),
    )
    expect(violations.map((v) => v.rule)).toEqual(['unhashed-output'])
  })

  it('passes that generator once its committed output is one of its inputs', () => {
    const generator = task({
      cache: false,
      inputs: [SUBMODULE_INPUT, 'src/table.generated.ts'],
      outputs: ['src/table.generated.ts'],
    })
    expect(check([generator], checkout([TABLE]))).toEqual([])
  })

  it('asks nothing of a generator whose inputs CI has', () => {
    // Its key moves whenever its output would, so a committed output it does not list is fine.
    const generator = task({ inputs: ['src/**'], outputs: ['gen/**'] })
    expect(check([generator], checkout(['packages/pkg/gen/a.hpp']))).toEqual([])
  })

  it('ignores a glob that is empty everywhere rather than only in CI', () => {
    // A shared task definition lists every package's inputs, so `proto/**` matches nothing in a
    // package with no protos -- on every machine alike, which leaves the key honest.
    expect(check([task({ inputs: ['proto/**', 'buf.gen.yaml'] })], checkout())).toEqual([])
  })

  it('does not check a task left on the default inputs', () => {
    expect(check([task({ inputs: [] })], checkout())).toEqual([])
  })
})
