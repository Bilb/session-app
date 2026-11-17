import { spawn, type ChildProcess } from 'node:child_process'

/** A step that could not be done: its message is what the developer is told. */
export class CompareFailure extends Error {}

/** The developer stopped the command: nothing after the step it stopped may run. */
export class Interrupted extends Error {}

/**
 * How long a step's child has to exit on its own after an interrupt. Ctrl-C reaches the whole
 * process group, so the child hears it too; a second signal would make Playwright stop without
 * closing the app. A signal sent to this process alone reaches the child only when passed on.
 */
const PASS_ON_AFTER_MS = 1_000

let child: ChildProcess | null = null
let interruptedBy: NodeJS.Signals | null = null

/** Whether a signal has arrived: a failure that follows one is the interrupt's doing. */
export function wasInterrupted(): boolean {
  return interruptedBy !== null
}

/** Throws `Interrupted` once a signal has arrived; called before and after every step. */
export function stopIfInterrupted(): void {
  if (interruptedBy !== null) throw new Interrupted(`interrupted by ${interruptedBy}`)
}

/**
 * Turns SIGINT and SIGTERM into `Interrupted` at the next step boundary rather than an exit, so
 * each `finally` on the way out runs: the base's worktree and a half-written capture are removed.
 * A second signal exits at once with `exitCode`.
 */
export function stopOnSignals(exitCode: number): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      if (interruptedBy !== null) process.exit(exitCode)
      interruptedBy = signal
      const running = child
      if (running === null) return
      setTimeout(() => {
        if (running.exitCode === null && running.signalCode === null) running.kill(signal)
      }, PASS_ON_AFTER_MS).unref()
    })
}

export function seconds(since: number): string {
  return `${((Date.now() - since) / 1000).toFixed(0)}s`
}

export interface StepOptions {
  cwd: string
  env?: NodeJS.ProcessEnv | undefined
}

/** Runs a step with its output shown and returns its exit code; an interrupt throws instead. */
export async function step(
  what: string,
  command: readonly string[],
  options: StepOptions,
): Promise<number> {
  stopIfInterrupted()
  const started = Date.now()
  console.log(`\n▶ ${what}`)
  const [program = '', ...args] = command
  const code = await new Promise<number>((resolve, reject) => {
    const spawned = spawn(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'inherit',
    })
    child = spawned
    spawned.on('error', reject)
    spawned.on('exit', (exitCode, signal) => {
      resolve(exitCode ?? (signal === null ? 1 : 128))
    })
  }).finally(() => {
    child = null
  })
  console.log(`  ${what}: ${code === 0 ? 'done' : `exit ${String(code)}`} in ${seconds(started)}`)
  stopIfInterrupted()
  return code
}

/** A step that must succeed, failing the comparison with `what` if it does not. */
export async function mustStep(
  what: string,
  command: readonly string[],
  options: StepOptions,
): Promise<void> {
  if ((await step(what, command, options)) !== 0) throw new CompareFailure(`${what} failed`)
}
