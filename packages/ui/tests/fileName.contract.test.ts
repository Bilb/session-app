import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

/** Held by reading the source: `packages/ui` renders nothing in its unit tier. */
describe('a file name', () => {
  const name = source('FileName.tsx')

  it('lays its two runs out in the name’s own direction, not the layout’s', () => {
    expect(name).toContain('style={{ direction: nameDirection(name) }}')
    expect(name).toContain('const { head, tail } = splitFilename(name)')
  })

  it('is one string to a screen reader and a test, never two runs', () => {
    expect(name).toMatch(/<XStack[^>]*aria-label=\{name\}[^>]*testID=\{testID\}/)
    expect(name.match(/<Text\b/g)).toHaveLength(2)
    expect(name.match(/\{\.\.\.ink\}/g)).toHaveLength(2)
  })

  it('is the one a file row and a staged tile both draw', () => {
    for (const file of ['FileRow.tsx', 'StagedTile.tsx']) {
      expect(source(file)).toContain('<FileName name=')
      expect(source(file)).not.toContain('splitFilename')
    }
  })
})
