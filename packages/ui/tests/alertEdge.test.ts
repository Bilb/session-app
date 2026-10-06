import { describe, expect, it } from 'vitest'

import { alertShadow } from '#src/alertEdge'

describe('alertShadow', () => {
  it("scales the theme's shadow colour to the iOS client's strength", () => {
    expect(alertShadow('rgba(0, 0, 0, 1)')).toBe('0px 0px 20px rgba(0, 0, 0, 0.4)')
    expect(alertShadow('rgba(0, 0, 0, 0.25)')).toBe('0px 0px 20px rgba(0, 0, 0, 0.1)')
  })

  it('falls back to black at full strength for a colour it cannot read', () => {
    expect(alertShadow('#000')).toBe('0px 0px 20px rgba(0, 0, 0, 0.4)')
  })
})
