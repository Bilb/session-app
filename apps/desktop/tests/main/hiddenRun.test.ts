import { describe, expect, it } from 'vitest'

import { HIDDEN_RUN_VARIABLE, hiddenRun } from '#src/main/hiddenRun'

const asked = { [HIDDEN_RUN_VARIABLE]: '1' }

describe('a hidden run', () => {
  it('is never asked for by default', () => {
    expect(hiddenRun({ packaged: false, env: {}, platform: 'darwin' })).toBeNull()
    expect(
      hiddenRun({ packaged: false, env: { [HIDDEN_RUN_VARIABLE]: '' }, platform: 'linux' }),
    ).toBeNull()
  })

  it('is refused by a packaged build, whatever its environment says', () => {
    expect(hiddenRun({ packaged: true, env: asked, platform: 'darwin' })).toBeNull()
  })

  it('creates the window hidden, drawing, and free to be larger than the screen', () => {
    const run = hiddenRun({ packaged: false, env: asked, platform: 'linux' })
    expect(run?.window).toEqual({
      show: false,
      paintWhenInitiallyHidden: true,
      enableLargerThanScreen: true,
    })
    expect(run?.webPreferences).toEqual({ backgroundThrottling: false })
    expect(run?.switches).toEqual([['force-device-scale-factor', '1']])
  })

  it('leaves the Dock and the menu bar on macOS only', () => {
    expect(hiddenRun({ packaged: false, env: asked, platform: 'darwin' })?.accessory).toBe(true)
    expect(hiddenRun({ packaged: false, env: asked, platform: 'linux' })?.accessory).toBe(false)
  })
})
