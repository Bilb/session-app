import { describe, expect, it } from 'vitest'

import { edgeFadeOpacity } from '#src/TrayEdgeFade'

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
})
