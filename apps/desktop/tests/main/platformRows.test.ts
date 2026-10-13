import { describe, expect, it } from 'vitest'

import { linuxRows, osText } from '#src/main/platformRows'

const UBUNTU = 'NAME="Ubuntu"\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nID=ubuntu\n'

describe('osText', () => {
  it('names macOS and Windows by version, and Linux by kernel', () => {
    expect(osText('darwin', '15.1', '24.1.0')).toBe('macOS 15.1')
    expect(osText('win32', '10.0.26100', '10.0.26100')).toBe('Windows 10.0.26100')
    expect(osText('linux', '6.8.0', '6.8.0-45-generic')).toBe('Linux 6.8.0-45-generic')
  })
})

describe('linuxRows', () => {
  it('has nothing to add off Linux', () => {
    expect(linuxRows({ platform: 'darwin', env: {}, osRelease: null, packaged: true })).toEqual([])
  })

  it('reads the distro, display server, desktop and packaging', () => {
    expect(
      linuxRows({
        platform: 'linux',
        env: { XDG_SESSION_TYPE: 'wayland', XDG_CURRENT_DESKTOP: 'GNOME', APPIMAGE: '/a.AppImage' },
        osRelease: UBUNTU,
        packaged: true,
      }),
    ).toEqual([
      ['Distro', 'Ubuntu 24.04.1 LTS'],
      ['Display', 'Wayland'],
      ['Desktop', 'GNOME'],
      ['Packaging', 'AppImage'],
    ])
  })

  it('says unknown rather than guessing', () => {
    expect(linuxRows({ platform: 'linux', env: {}, osRelease: null, packaged: true })).toEqual([
      ['Distro', 'unknown'],
      ['Display', 'unknown'],
      ['Desktop', 'unknown'],
      ['Packaging', 'unknown'],
    ])
    expect(
      linuxRows({ platform: 'linux', env: { DISPLAY: ':0' }, osRelease: '', packaged: true })[1],
    ).toEqual(['Display', 'X11'])
  })

  it('says a run that was never packaged is a dev run', () => {
    const env = { APPIMAGE: '/a.AppImage' }
    expect(linuxRows({ platform: 'linux', env, osRelease: null, packaged: false })[3]).toEqual([
      'Packaging',
      'dev',
    ])
  })
})
