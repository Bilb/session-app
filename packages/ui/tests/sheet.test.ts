import { RADII } from '@session/theme-tokens'
import { describe, expect, it } from 'vitest'

import { SHEET_MAX_HEIGHT, SHEET_MAX_WIDTH, SHEET_RADIUS } from '#src/sheet'

describe('a sheet’s metrics', () => {
  it('takes the corner the radius ladder names for a bottom sheet', () => {
    expect(SHEET_RADIUS).toBe(RADII.xl)
  })

  it('stops short of the whole window', () => {
    // What is left is both the thing that says this is over the conversation rather than a screen
    // somebody navigated to, and somewhere to tap that is obviously "out".
    expect(SHEET_MAX_HEIGHT).toBe('80%')
  })

  it('is wider than the alert, because it holds rows rather than a sentence', () => {
    // `Modal` caps at 360. A row is a thumbnail, a name, a size and a control.
    expect(SHEET_MAX_WIDTH).toBeGreaterThan(360)
  })
})
