import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `destructive` colours a label and does nothing else.
 *
 * It is applied after `variant`, so its whole job is to stop that variant's own colour winning
 * over the danger red. What a press does to the *surface* belongs to the variant -- `ghost`
 * lights a background, `simple` dims itself, `danger` fills -- and anything this adds lands on
 * top of that.
 *
 * An `opacity` here is the way that goes wrong, because opacity is inherited by the whole
 * subtree: it fades the label along with the fill, so the red `Open` in the link dialog dims as it
 * is held when only the surface behind it should move.
 */
describe('the destructive variant', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/Button.tsx'), 'utf8')

  /**
   * The `destructive` entry of the variants table, from its key to the end of its block, with the
   * comments taken out -- one of which explains the very rule this asserts, and says `opacity`.
   */
  const block = (() => {
    const start = source.indexOf('destructive: {')
    expect(start).toBeGreaterThan(-1)
    const end = source.indexOf('\n    },', start)
    return source
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
  })()

  it('sets no opacity in any state', () => {
    expect(block).not.toMatch(/opacity/)
  })

  it('sets nothing but a colour', () => {
    const properties = [...block.matchAll(/([a-zA-Z]+):\s/g)]
      .map((m) => m[1])
      .filter((name) => !['destructive', 'true', 'hoverStyle', 'pressStyle'].includes(name ?? ''))
    expect([...new Set(properties)]).toEqual(['color'])
  })
})
