import { describe, expect, it } from 'vitest'

import { edgeFadeOpacity, TrayEdgeFade } from '#src/TrayEdgeFade'

import { renderInUI } from './support/render'

describe('a staged tray end’s fade', () => {
  it('is absent at the end, and eases in as tiles scroll out of sight', () => {
    expect(edgeFadeOpacity(0)).toBe(0)
    expect(edgeFadeOpacity(1)).toBeLessThan(0.05)
    expect(edgeFadeOpacity(20)).toBe(0.5)
  })

  it('is whole once a fade’s width is hidden, and never past it', () => {
    expect(edgeFadeOpacity(40)).toBe(1)
    expect(edgeFadeOpacity(400)).toBe(1)
    expect(edgeFadeOpacity(-3)).toBe(0)
  })

  it('takes no pointer events from its outermost view in, so the tiles under it get them', () => {
    const { container } = renderInUI(<TrayEdgeFade side="end" heightPx={112} opacity={0.5} />)
    const outermost = container.querySelector('.is_View')
    expect(outermost).not.toBeNull()
    if (outermost === null) return
    expect(outermost.querySelector('svg')).not.toBeNull()
    // Tamagui's atomic classes: jsdom does not apply the rules they name.
    expect(outermost.classList).toContain('_pe-none')
    expect(outermost.classList).toContain('_pos-absolute')
  })
})
