import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What the path's status says by shape, held by reading the source: `packages/ui` renders
 * nothing in its unit tier.
 */
const source = readFileSync(join(import.meta.dirname, '../src/StatusDot.tsx'), 'utf8')
const glyphs = source.slice(source.indexOf('function Glyph'), source.indexOf('export function'))

describe('the status dot', () => {
  it('draws a glyph for every tone, so no state is told apart by colour alone', () => {
    for (const tone of ['positive', 'warning', 'danger', 'neutral'])
      expect(glyphs).toContain(`case '${tone}':`)
  })

  it('crosses out no path rather than dashing it, which would read as the ellipsis', () => {
    const danger = glyphs.slice(glyphs.indexOf("case 'danger':"), glyphs.indexOf("case 'neutral':"))
    expect(danger).toMatch(/M8 8 16 16M16 8 8 16/)
  })

  it('inks every glyph in black, whatever the theme', () => {
    expect(glyphs).toContain('const ink = COLORS.BLACK')
    expect(glyphs).not.toMatch(/\$text|\$background/)
  })

  it('cuts itself out of what it overlaps in the pane surface', () => {
    expect(source).toContain('useTokenColor(usePaneSurface())')
    expect(source).toContain('borderColor={surface}')
  })
})
