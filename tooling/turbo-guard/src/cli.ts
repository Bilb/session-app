import { execFileSync } from 'node:child_process'
import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { absentSubmodules, turboTasksIn } from '#src/ci'
import { check, type Task } from '#src/rules'

const repoRoot = join(import.meta.dirname, '../../..')
const WORKFLOW = '.github/workflows/ci.yml'

const workflow = readFileSync(join(repoRoot, WORKFLOW), 'utf8')
const scripts = (
  JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
).scripts
const absent = absentSubmodules(readFileSync(join(repoRoot, '.gitmodules'), 'utf8'), workflow)
const names = turboTasksIn(workflow, scripts)

interface DryTask {
  taskId: string
  directory: string
  command: string
  resolvedTaskDefinition: { cache: boolean; inputs: string[]; outputs: string[] }
}

// The run graph turbo would execute for CI's steps, dependencies included -- so a task only ever
// reached through `^build` is checked, and one no CI step reaches, like the native build, is not.
const dry = JSON.parse(
  execFileSync('pnpm', ['exec', 'turbo', 'run', ...names, '--dry=json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { tasks: DryTask[] }

const tasks: Task[] = dry.tasks
  // A package with no script for the task still appears in the graph, and runs nothing.
  .filter((task) => task.command !== '<NONEXISTENT>')
  .map((task) => ({
    id: task.taskId,
    directory: task.directory,
    cache: task.resolvedTaskDefinition.cache,
    inputs: task.resolvedTaskDefinition.inputs,
    outputs: task.resolvedTaskDefinition.outputs,
  }))

const committed = new Set(
  execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n'),
)

const violations = check(tasks, {
  absent,
  committed: (glob) => globSync(glob, { cwd: repoRoot }).filter((path) => committed.has(path)),
})

const without = absent.length === 0 ? '' : ` (without ${absent.join(', ')})`
if (violations.length === 0) {
  process.stdout.write(
    `turbo-guard: ${String(tasks.length)} tasks in CI's run checked against its checkout${without}\n`,
  )
} else {
  for (const violation of violations)
    process.stderr.write(`turbo-guard: ${violation.task} [${violation.rule}] ${violation.detail}\n`)
  process.stderr.write(
    `\nChecked as CI's checkout${without}. See "The build graph" in docs/ARCHITECTURE.md.\n`,
  )
  process.exit(1)
}
