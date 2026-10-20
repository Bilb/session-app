import { describe, expect, it } from 'vitest'

import { launchOverridesSwitch, readLaunchOverrides } from '#src/shared/launchOverrides'

describe('the launch overrides switch', () => {
  it('carries the theme and accent main was started with to the preload', () => {
    const argv = [
      '--type=renderer',
      launchOverridesSwitch({
        EXPO_PUBLIC_SESSION_THEME: 'ocean-light',
        EXPO_PUBLIC_SESSION_ACCENT: 'blue',
      }),
    ]
    expect(readLaunchOverrides(argv)).toEqual({
      EXPO_PUBLIC_SESSION_THEME: 'ocean-light',
      EXPO_PUBLIC_SESSION_ACCENT: 'blue',
    })
  })

  it('leaves out what is unset or empty, as an unset variable reads', () => {
    const argv = [launchOverridesSwitch({ EXPO_PUBLIC_SESSION_THEME: '', HOME: '/home/someone' })]
    expect(readLaunchOverrides(argv)).toEqual({})
  })

  it('carries nothing but the names it is for', () => {
    const forged =
      '--session-launch-overrides={"EXPO_PUBLIC_SESSION_FAKE":"1","EXPO_PUBLIC_SESSION_THEME":7}'
    expect(readLaunchOverrides([forged])).toEqual({})
  })

  it('reads nothing from a switch that is absent or not JSON', () => {
    expect(readLaunchOverrides(['--type=renderer'])).toEqual({})
    expect(readLaunchOverrides(['--session-launch-overrides={'])).toEqual({})
  })
})
