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
    // On the document: a resting pointer opens it while focus is somewhere else entirely.
    expect(web).toContain("document.addEventListener('keydown', onKeyDown)")
    expect(web).toContain('onMouseDown={hide}')
  })

  it('goes on a keyboard press of the control too, which fires no mouse event', () => {
    expect(web).toContain("new Set(['Enter', ' '])")
    expect(web).toContain(
      'PRESS_KEYS.has(event.key) && wrapper.current?.contains(event.target as Node)',
    )
  })

  it('keeps the bubble inside the wrapper, so moving onto it does not close it', () => {
    expect(web.indexOf('{children}')).toBeLessThan(web.indexOf('{open ? ('))
    expect(web).not.toContain('pointerEvents="none"')
  })

  it('hides the bubble from assistive technology, which reads the control’s own label', () => {
    expect(web).toMatch(/<YStack\s+aria-hidden/)
  })

  it('points at the control, with the arrow under the label', () => {
    expect(web).toContain('<TooltipArrow placement={placement} bubble={bubble} />')
    expect(web.indexOf('<TooltipArrow')).toBeLessThan(web.indexOf('<Text'))
  })
})

describe('the tooltip on native', () => {
  it('opens for a pointer only, never for a finger', () => {
    expect(native).toMatch(
      /onPointerEnter=\{\(event: PointerEvent\) => \{\s*if \(event\.nativeEvent\.pointerType === 'touch'\) return/,
    )
  })

  it('closes as the pointer leaves or presses', () => {
    expect(native).toContain('onPointerLeave={hide}')
    expect(native).toContain('onPointerDown={hide}')
  })

  it('is hidden from assistive technology, which reads the control’s label instead', () => {
    expect(native).toContain('importantForAccessibility="no-hide-descendants"')
    expect(native).toContain('accessibilityElementsHidden')
  })

  it('points at the control, with the arrow under the label', () => {
    expect(native).toContain('<TooltipArrow placement={placement} bubble={bubble} />')
    expect(native.indexOf('<TooltipArrow')).toBeLessThan(native.indexOf('<Text'))
  })
})
