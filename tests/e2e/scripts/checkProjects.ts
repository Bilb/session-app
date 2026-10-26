import { execFileSync } from 'node:child_process'

/**
 * Fails when a test is in no Playwright project. Each project selects by its tag, so a spec that
 * launches an app itself and forgets the tag would otherwise run nowhere, silently.
 */

interface Spec {
  title: string
  file: string
  line: number
  tests: unknown[]
}

interface Suite {
  specs?: Spec[]
  suites?: Suite[]
}

function listed(...config: string[]): Set<string> {
  const json = execFileSync('playwright', ['test', '--list', '--reporter=json', ...config], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const found = new Set<string>()
  const walk = (suite: Suite) => {
    for (const spec of suite.specs ?? [])
      if (spec.tests.length > 0) found.add(`${spec.file}:${String(spec.line)} › ${spec.title}`)
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of (JSON.parse(json) as { suites: Suite[] }).suites) walk(suite)
  return found
}

const selected = listed()
const unselected = [...listed('--config', 'playwright.unfiltered.config.ts')].filter(
  (test) => !selected.has(test),
)

if (unselected.length > 0) {
  console.error(
    `${String(unselected.length)} test(s) in no project; tag each with its platform, ` +
      `@desktop for a spec that launches DesktopApp itself:\n${unselected.join('\n')}`,
  )
  process.exit(1)
}
console.log(`every one of ${String(selected.size)} tests is in a project`)
