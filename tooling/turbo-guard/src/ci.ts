/**
 * Reading CI's own configuration, so the guard checks what CI runs rather than a list that drifts.
 *
 * Deliberately line-based rather than a YAML parse: the two shapes it reads are one-line steps, and
 * a parser would be a dependency for the sake of two regular expressions.
 */

/** The turbo tasks a workflow's `pnpm <script>` steps start, through the root package's scripts. */
export function turboTasksIn(workflow: string, scripts: Record<string, string>): string[] {
  const tasks = new Set<string>()
  for (const match of workflow.matchAll(/^\s*- run: pnpm ([\w:-]+)\s*$/gm)) {
    const command = scripts[match[1] as string]
    const turbo = command === undefined ? null : /^turbo (?:run )?(.+)$/.exec(command)
    if (turbo !== null) for (const task of (turbo[1] as string).split(/\s+/)) tasks.add(task)
  }
  return [...tasks]
}

/**
 * Submodules the workflow leaves out, which is everything it does not name in a
 * `git submodule update --init` step.
 *
 * What makes the guard's answer CI's rather than the developer's: a tree with libsession checked
 * out has every input present, and would pass exactly the configuration that failed on #34.
 */
export function absentSubmodules(gitmodules: string, workflow: string): string[] {
  const all = [...gitmodules.matchAll(/^\s*path\s*=\s*(\S+)\s*$/gm)].map((m) => m[1] as string)
  const initialised = [...workflow.matchAll(/git submodule update --init[^\n]*$/gm)].flatMap((m) =>
    m[0].split(/\s+/).filter((word) => all.includes(word)),
  )
  return all.filter((path) => !initialised.includes(path))
}
