import { describe, expect, it } from 'vitest'

import { backupRow, userDataPlacement } from '#src/main/userData'

const HOME = 'C:\\Users\\alice'

describe('userDataPlacement', () => {
  it('puts Windows data in Local AppData, never Roaming', () => {
    expect(
      userDataPlacement({
        platform: 'win32',
        env: {
          LOCALAPPDATA: 'C:\\Users\\alice\\AppData\\Local',
          APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
        },
        home: HOME,
        name: 'session-app',
      }),
    ).toEqual({
      path: 'C:\\Users\\alice\\AppData\\Local\\session-app',
      exclusion: 'local-appdata',
    })
  })

  it('falls back to the conventional Local AppData when the variable is missing or empty', () => {
    const expected = 'C:\\Users\\alice\\AppData\\Local\\session-app'
    for (const env of [{}, { LOCALAPPDATA: '' }]) {
      expect(
        userDataPlacement({ platform: 'win32', env, home: HOME, name: 'session-app' }).path,
      ).toBe(expected)
    }
  })

  it("leaves macOS and Linux where Electron puts them, excluding macOS's from Time Machine", () => {
    const placed = (platform: NodeJS.Platform) =>
      userDataPlacement({ platform, env: {}, home: '/home/alice', name: 'session-app' })
    expect(placed('darwin')).toEqual({ path: null, exclusion: 'time-machine' })
    expect(placed('linux')).toEqual({ path: null, exclusion: 'none' })
  })
})

describe('backupRow', () => {
  it('says what was done, or why it was not', () => {
    expect(backupRow('time-machine', null)).toEqual(['Backup', 'excluded from Time Machine'])
    expect(backupRow('local-appdata', null)).toEqual(['Backup', 'Local AppData, not roaming'])
    expect(backupRow('none', null)).toEqual(['Backup', 'no exclusion on this platform'])
    expect(backupRow('time-machine', 'tmutil: not found')).toEqual([
      'Backup',
      'not excluded: tmutil: not found',
    ])
  })
})
