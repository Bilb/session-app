import { appendFileSync } from 'node:fs'

import { Interrupted, step, stopOnSignals } from '#catalog/steps'

// A command shaped like catalog:compare: a long step, a step after it, and cleanup on the way out.
const log = process.argv[2] ?? ''
const note = (line: string) => {
  appendFileSync(log, `${line}\n`)
}

stopOnSignals(3)

async function main(): Promise<void> {
  try {
    await step('wait', ['sleep', '30'], { cwd: process.cwd() })
    note('after the long step')
    await step('next', ['true'], { cwd: process.cwd() })
    note('the next step ran')
  } finally {
    note('cleaned up')
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => process.exit(error instanceof Interrupted ? 2 : 4),
)
