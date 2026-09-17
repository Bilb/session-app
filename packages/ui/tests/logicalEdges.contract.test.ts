import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * An edge that follows the reading direction is named for the direction, not the side.
 *
 * `marginStart`, `paddingEnd`, `start`, `end` — not `marginLeft`, `paddingRight`, `left`, `right`.
 * The two are the same thing in English and opposite things in Arabic, and the app ships Arabic,
 * Baluchi, Persian, Hebrew, Pashto and Urdu. A physical edge is not a bug anybody sees until a
 * layout mirrors, at which point every one of them is wrong at once, so the convention is the
 * thing worth holding rather than the individual fix.
 *
 * Caught here rather than by review because it is a habit: the physical name is the one that comes
 * to mind, it reads correctly in the language the code is written in, and nothing about it looks
 * wrong on screen.
 */
describe('a directional edge', () => {
  const roots = [
    join(import.meta.dirname, '../src'),
    join(import.meta.dirname, '../../screens/src'),
  ]

  /**
   * Where a physical side is the right answer, and why.
   *
   * A device inset is physical: the notch is on the side it is on whatever the reading direction,
   * so `SafeArea` and `Screen` must not follow the text. A `left`/`right` pair used together is a
   * symmetric stretch rather than a side. `LanguagePicker` places its panel against a *measured*
   * rectangle in window coordinates, and a measurement is physical -- what mirrors there is which
   * edge of the trigger it aligns to, which `panelLeft` takes as an argument.
   */
  const PHYSICAL_ON_PURPOSE = [
    'SafeArea.native.tsx',
    'Screen.native.tsx',
    'PhoneChrome.tsx',
    'LanguagePicker.tsx',
  ]

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sources(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  it('is named for the direction rather than the side', () => {
    const offenders = roots
      .flatMap(sources)
      .map((path) => ({
        name: path.slice(path.lastIndexOf('/') + 1),
        source: readFileSync(path, 'utf8'),
      }))
      .filter(({ name }) => !PHYSICAL_ON_PURPOSE.includes(name))
      .flatMap(({ name, source }) =>
        [...source.matchAll(/\b(margin|padding)(Left|Right)\b|\b(left|right)=\{/g)].map(
          (match) => `${name}: ${match[0]}`,
        ),
      )

    expect(offenders).toEqual([])
  })
})
