import { posix } from 'node:path'

/** A task in the run, as far as the rules need to know it. */
export interface Task {
  id: string
  /** The package's directory, relative to the repo root. Globs are relative to it. */
  directory: string
  cache: boolean
  /** Declared input globs. Empty means turbo's default, every file in the package. */
  inputs: string[]
  outputs: string[]
}

/** What CI's checkout lacks, and what is committed. Paths are relative to the repo root. */
export interface Checkout {
  /** Submodules CI does not check out. */
  absent: readonly string[]
  /** Committed files matching a glob. */
  committed: (glob: string) => string[]
}

/**
 * Whether a glob names files CI will not have.
 *
 * Decided by where it points rather than by what it matches, so the answer is the same in CI and
 * in a tree that has every submodule. Matching would confuse two different things: a glob that is
 * empty because CI left a submodule out, which is a hole in the cache key, and one that is empty
 * everywhere -- a shared task definition's `proto/**` in a package with no protos -- which hashes
 * the same nothing on every machine and is harmless.
 */
export function missingInCi(glob: string, absent: readonly string[]): boolean {
  return absent.some((sub) => glob === sub || glob.startsWith(`${sub}/`))
}

export interface Violation {
  task: string
  rule: 'absent-input' | 'unhashed-output'
  detail: string
}

/**
 * A declared glob as the repo sees it, or null for the entries that are not paths.
 *
 * `$TURBO_DEFAULT$` stands for the package's own files, which exist wherever the package does, and
 * a negation only removes files -- neither can be an input that is missing.
 */
export function fromPackage(directory: string, glob: string): string | null {
  if (glob.startsWith('!') || glob.startsWith('$')) return null
  return posix.normalize(posix.join(directory, glob))
}

/**
 * Where a task's cache key fails to cover what its output depends on.
 *
 * **Two rules, for the two ways it went wrong on the URL table.**
 *
 * `absent-input`: a cached task declares an input CI will not have. Its key cannot move when that
 * input changes, so a cache hit restores an output made from a different one. That is what
 * restored the old table over a committed regeneration: CI has no libsession checkout, so the
 * generator's two submodule inputs contributed nothing and it hashed to a constant.
 *
 * `unhashed-output`: a task with such an input writes a committed file that is not also one of its
 * inputs. Where the generator cannot run, the committed file *is* its output, and a task's hash is
 * what reaches the tasks depending on it -- so without it a dependant's key never sees the file
 * change. Only for tasks with an absent input: a generator whose inputs are all present moves its
 * key whenever its output would, and asking it to list its output as well would be noise.
 */
export function check(tasks: readonly Task[], checkout: Checkout): Violation[] {
  const violations: Violation[] = []

  for (const task of tasks) {
    const inputs = task.inputs
      .map((glob) => fromPackage(task.directory, glob))
      .filter((glob): glob is string => glob !== null)
    const absent = inputs.filter((glob) => missingInCi(glob, checkout.absent))
    if (absent.length === 0) continue

    if (task.cache)
      for (const glob of absent)
        violations.push({
          task: task.id,
          rule: 'absent-input',
          detail: `input ${glob} is not in CI's checkout, so this task's cache key cannot move when it changes`,
        })

    const hashed = new Set(inputs.flatMap((glob) => checkout.committed(glob)))
    const written = task.outputs
      .map((glob) => fromPackage(task.directory, glob))
      .filter((glob): glob is string => glob !== null)
      .flatMap((glob) => checkout.committed(glob))
    for (const file of written)
      if (!hashed.has(file))
        violations.push({
          task: task.id,
          rule: 'unhashed-output',
          detail: `writes committed ${file} but does not list it as an input, and one of its inputs is not in CI's checkout -- so nothing depending on this task sees that file change`,
        })
  }

  return violations
}
