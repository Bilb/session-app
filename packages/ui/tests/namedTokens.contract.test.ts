import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A prop that takes a space, dimension or radius token names it rather than numbering it.
 *
 * Those three scales are keyed by name, so a numeric token resolves against none of them -- and a
 * token tamagui cannot resolve is **0, in silence**, which is a control that renders at nothing
 * rather than an error anybody sees.
 *
 * `tokens.contract.test.ts` cannot catch this, and the gap is worth stating because it looks like
 * it should: it checks a token against the union of every scale's keys, and the z-index scale is
 * still numbered. So `left="$3"` passes there -- `3` is a real name, just not one the *space*
 * scale has. Only the prop says which scale is being read, which is why this checks by prop.
 *
 * `size` and `fontSize` are the easiest two to leave out, because neither reads the space scale:
 * `size` takes the size scale on a control and the font scale on text. Both are named, so a
 * numbered token on either is a control that renders at nothing.
 */
describe('a token on a sized prop', () => {
  const NUMBERED =
    /\b(size|fontSize|padding|margin|gap|columnGap|rowGap|space|height|width|top|bottom|left|right|start|end|inset|borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius|flexBasis)([A-Za-z]*)(?:="\$([0-9]+(?:\.[0-9])?)"|: '\$([0-9]+(?:\.[0-9])?)')/g

  const roots = [
    join(import.meta.dirname, '../src'),
    join(import.meta.dirname, '../../screens/src'),
    join(import.meta.dirname, '../../app/src'),
  ]

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sources(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  it('is named, because a numeric one resolves to nothing', () => {
    const offenders = roots
      .flatMap(sources)
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(NUMBERED)].map(
          (match) => `${path.slice(path.lastIndexOf('/') + 1)}: ${match[0]}`,
        ),
      )

    expect(offenders).toEqual([])
  })
})
