import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { generate } from '#src/generate'

const here = import.meta.dirname
const repo = resolve(here, '../../..')
const entryFile = join(repo, 'packages/bridge-types/src/index.ts')
const outDir = join(repo, 'packages/bridge-core/include/session_bridge/gen')

const files = generate({
  entryFile,
  // Frame is everything the shim emits; Request is everything it accepts. Together they reach
  // every type the protocol uses.
  roots: ['Frame', 'Request'],
  sourceLabel: 'packages/bridge-types/src',
})

mkdirSync(outDir, { recursive: true })
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(outDir, name), content)
}
writeFileSync(join(outDir, '.gitattributes'), '* linguist-generated=true\n')
console.log(`wrote ${Object.keys(files).join(', ')} to ${outDir}`)
