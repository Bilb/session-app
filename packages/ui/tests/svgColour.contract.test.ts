import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * No CSS variable may be handed to react-native-svg as a colour.
 *
 * `var(--textPrimary)` resolves against the stylesheet tamagui writes for the web. On native there
 * is no stylesheet and no `var()`, so the value is not a colour and the shape is drawn with
 * nothing — silently, and only on one platform. The Session wordmark, the ring around the link
 * icon, the recovery-password mark and the whole restore progress ring were all invisible on iOS
 * for exactly this reason, while the desktop build looked correct throughout.
 *
 * A grep rather than a render test because that is the shape of the mistake: it is not that one
 * component computed the wrong value, it is that a whole spelling of colour works on one platform
 * and not the other. `useTokenColor` is what to reach for instead.
 */
describe('colours reaching SVG', () => {
  const roots = [
    join(import.meta.dirname, '../src'),
    join(import.meta.dirname, '../../screens/src'),
  ]

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sources(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  it('are never CSS variables', () => {
    const offenders = roots
      .flatMap(sources)
      // tamaguiCSS.ts writes the stylesheet itself, so it is the one place var() belongs.
      .filter((path) => !path.endsWith('tamaguiCSS.ts'))
      .filter((path) => /(?:color|stroke|fill)=["{]?["']?var\(--/.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
