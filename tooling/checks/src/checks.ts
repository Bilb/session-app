/**
 * Every `pnpm` step of `.github/workflows/ci.yml`, and whether a git hook runs it too.
 *
 * turbo-guard fails when this and the workflow disagree, so a check added to CI has to be placed
 * here: in a hook, or in CI alone with the reason it cannot run earlier.
 */

export type HookStage = 'pre-commit' | 'pre-push'

interface WithRun {
  /** What follows `pnpm ` in the workflow step, verbatim. */
  run: string
}

export interface HookCheck extends WithRun {
  stage: HookStage
  /** Runs only when a file the commit stages, or the push carries, matches. Absent: always. */
  when?: RegExp | undefined
  /** A turbo script, narrowed by the hook to the changed packages and those depending on them. */
  perPackage?: boolean | undefined
}

export interface CiOnlyCheck extends WithRun {
  stage: 'ci-only'
  because: string
}

export type Check = HookCheck | CiOnlyCheck

const CODE = /\.[cm]?[jt]sx?$/
const MANIFEST = /(^|\/)package\.json$|^pnpm-(lock|workspace)\.yaml$/

export const CHECKS: readonly Check[] = [
  {
    run: 'install --frozen-lockfile',
    stage: 'ci-only',
    because: "CI's setup: a hook runs in a checkout that is already installed.",
  },
  { run: 'format:check', stage: 'pre-commit' },
  { run: 'lint', stage: 'pre-push', perPackage: true },
  // Unconditional: turbo-guard reads turbo.json, .gitmodules and every source file's imports.
  { run: 'lint:manifests', stage: 'pre-commit' },
  { run: 'boundaries', stage: 'pre-commit', when: new RegExp(`${CODE.source}|${MANIFEST.source}`) },
  { run: 'typecheck', stage: 'pre-push', perPackage: true },
  { run: 'test', stage: 'pre-push', perPackage: true },
  { run: 'test:native', stage: 'ci-only', because: 'needs a C++ toolchain with ThreadSanitizer' },
  { run: 'knip', stage: 'pre-push' },
  { run: 'dedupe --check', stage: 'pre-commit', when: MANIFEST },
  { run: 'codegen:check', stage: 'pre-commit', when: /^packages\/bridge-types\// },
]

/** The pnpm arguments a hook at `stage` runs, given the files it covers and the push's base. */
export function commandsFor(
  checks: readonly Check[],
  stage: HookStage,
  files: readonly string[],
  base: string | null,
): string[][] {
  return checks
    .filter((check): check is HookCheck => check.stage === stage)
    .filter((check) => check.when === undefined || files.some((file) => check.when?.test(file)))
    .map((check) => {
      const args = check.run.split(' ')
      return check.perPackage === true && base !== null ? [...args, `--filter=...[${base}]`] : args
    })
}
