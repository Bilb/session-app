import type { BrowserWindowConstructorOptions, WebPreferences } from 'electron'

/**
 * Set to `1` by whatever runs the e2e harness where a window must not appear: a local catalog
 * comparison on a developer's Mac, where a 3000-pixel window taking focus is the problem rather
 * than the picture. Unprefixed because it describes the host the run is on, not the app.
 */
export const HIDDEN_RUN_VARIABLE = 'SESSION_E2E_HIDDEN'

/**
 * How a hidden run differs from an ordinary one. Each piece is a part of Electron's own API, so
 * nothing below the window changes: the page lays out, paints and is captured as it would be on
 * screen.
 */
export interface HiddenRun {
  /**
   * Chromium switches, appended before the app is ready. A window nobody sees has no display to
   * match, so it draws at 1x, as the Linux captures Argos compares with are drawn.
   */
  switches: readonly (readonly [name: string, value: string])[]
  /**
   * macOS: no Dock icon and no menu bar. Set before the app finishes launching, it is what keeps
   * the launch from taking focus from whatever the developer is typing into.
   */
  accessory: boolean
  /**
   * Never shown, and drawn anyway: `paintWhenInitiallyHidden` keeps the renderer active without
   * a `show()`, and macOS otherwise clamps a resize to the screen in both directions, which would
   * leave the catalog's 3000-pixel layout at the width of a laptop and cut off a page taller than
   * the screen.
   */
  window: Pick<
    BrowserWindowConstructorOptions,
    'show' | 'paintWhenInitiallyHidden' | 'enableLargerThanScreen'
  >
  /** A hidden page counts as a background one, whose timers and frames Chromium would throttle. */
  webPreferences: Pick<WebPreferences, 'backgroundThrottling'>
}

/** The hidden run asked for, or null. A packaged build is never hidden, whatever its env says. */
export function hiddenRun({
  packaged,
  env,
  platform,
}: {
  packaged: boolean
  env: Readonly<Record<string, string | undefined>>
  platform: NodeJS.Platform
}): HiddenRun | null {
  if (packaged || env[HIDDEN_RUN_VARIABLE] !== '1') return null
  return {
    switches: [['force-device-scale-factor', '1']],
    accessory: platform === 'darwin',
    window: { show: false, paintWhenInitiallyHidden: true, enableLargerThanScreen: true },
    webPreferences: { backgroundThrottling: false },
  }
}
