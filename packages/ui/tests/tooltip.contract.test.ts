import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What the tooltip does for a keyboard and a pointer, held by reading the source: `packages/ui`
 * renders nothing in its unit tier, and the behaviour is in the handlers rather than in anything a
 * snapshot would show.
 */
const dir = join(import.meta.dirname, '../src')
const web = readFileSync(join(dir, 'Tooltip.tsx'), 'utf8')
const native = readFileSync(join(dir, 'Tooltip.native.tsx'), 'utf8')

describe('the tooltip on the web', () => {
  it('opens on a resting pointer, after a delay, and closes as the pointer leaves', () => {
    expect(web).toMatch(/onMouseEnter=\{\(\) => \{[^}]*setTimeout\(show, HOVER_DELAY_MS\)/)
    expect(web).toContain('onMouseLeave={hide}')
  })

  it('opens on keyboard focus but not on the focus a click gives', () => {
    expect(web).toMatch(
      /onFocus=\{\(event: FocusEvent\) => \{\s*if \(focusVisible\(event\)\) show\(\)/,
    )
    expect(web).toContain("matches(':focus-visible')")
    expect(web).toContain('onBlur={hide}')
  })

  it('can be dismissed with Escape without moving focus, and goes on a press', () => {
    expect(web).toMatch(/if \(event\.key === 'Escape'\) hide\(\)/)
    expect(web).toContain('onMouseDown={hide}')
  })

  it('keeps the bubble inside the wrapper, so moving onto it does not close it', () => {
    expect(web.indexOf('{children}')).toBeLessThan(web.indexOf('{open ? ('))
    expect(web).not.toContain('pointerEvents="none"')
  })

  it('hides the bubble from assistive technology, which reads the control’s own label', () => {
    expect(web).toMatch(/<YStack\s+aria-hidden/)
  })
})

describe('the tooltip on touch', () => {
  it('draws the control alone', () => {
    expect(native).toMatch(/return <>\{children\}<\/>/)
  })
})
