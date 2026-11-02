import { describe, expect, it } from 'vitest'

import { CAPTURE_WINDOW, MAX_CAPTURE_WINDOW, windowFor } from '#catalog/captureWindow'

describe('the capture window', () => {
  it('stays at the capture window for a page inside it', () => {
    expect(windowFor({ width: 2800, height: 1200 })).toEqual(CAPTURE_WINDOW)
  })

  it('grows only the height for a page taller than the window', () => {
    expect(windowFor({ width: 2800, height: 2963.4 })).toEqual({
      width: CAPTURE_WINDOW.width,
      height: 2964,
    })
  })

  it('grows the width only for a page already wider than the window', () => {
    expect(windowFor({ width: 3100.2, height: 900 })).toEqual({
      width: 3101,
      height: CAPTURE_WINDOW.height,
    })
  })

  it('holds a page that reaches the cap exactly', () => {
    expect(windowFor(MAX_CAPTURE_WINDOW)).toEqual(MAX_CAPTURE_WINDOW)
  })

  it('refuses a page past the cap on either side, naming its size', () => {
    expect(() => windowFor({ width: 2800, height: MAX_CAPTURE_WINDOW.height + 1 })).toThrow(
      `reaches ${String(CAPTURE_WINDOW.width)}x${String(MAX_CAPTURE_WINDOW.height + 1)} px`,
    )
    expect(() => windowFor({ width: MAX_CAPTURE_WINDOW.width + 1, height: 100 })).toThrow(
      /past the \d+x\d+ capture window/,
    )
  })
})
