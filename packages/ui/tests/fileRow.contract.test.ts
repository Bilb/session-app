import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * What `FileRow` draws that a list and a mirrored layout depend on, held by reading the source:
 * `packages/ui` renders nothing in its unit tier, and neither shows in a browser in English.
 */
describe('a file row', () => {
  const row = readFileSync(join(import.meta.dirname, '../src/FileRow.tsx'), 'utf8')
  // Everything the row carries when it takes a press is in the one spread `onPress` switches on.
  const rowPress =
    /\{\.\.\.\(onPress === undefined\s*\?\s*\{\}\s*:\s*\{([\s\S]*?)\}\)\}/.exec(row)?.[1] ?? ''
  // The same for the lead square, whose spread `openLabel` switches on.
  const leadPress =
    /\{\.\.\.\(openLabel === undefined\s*\?\s*\{\}\s*:\s*\{([\s\S]*?)\}\)\}/.exec(row)?.[1] ?? ''
  const control = row.slice(
    row.indexOf('function Trailing('),
    row.indexOf('export function FileRow('),
  )

  it('holds the lead at the height fileRowHeight counts, with the padding it counts', () => {
    // `getItemLayout` places rows by that constant, so a row that measured differently would
    // scroll to the wrong place.
    expect(row).toMatch(
      /<YStack\s+width=\{FILE_LEAD_WIDTH\}\s+height=\{fileLeadHeight\(fontScale\)\}/,
    )
    expect(row).toMatch(
      /<XStack\s+alignItems="center"\s+gap=\{FILE_ROW_GAP\}\s+paddingVertical="\$xs"/,
    )
  })

  it('takes its direction from the name’s own script, on the name and caption together', () => {
    // Pinned to the layout, an Arabic name read tail-first in one direction or the other.
    expect(row).toContain('direction: nameDirection(filename)')
    expect(row).toMatch(/<YStack flex=\{1\} minWidth=\{0\} gap="\$3xs" style=\{direction\}>/)
    expect(row).not.toContain("direction: 'ltr'")
    expect(row).toMatch(
      /<Text[^>]*alignSelf="flex-start"[^>]*style=\{CAPTION_BIDI\}[^>]*testID=\{testIDs\?\.caption\}/,
    )
    // The caption is the app's copy: under an Arabic name, "52.5 kB" would read "kB 52.5".
    expect(row).toContain("unicodeBidi: 'plaintext'")
  })

  it('draws every text and glyph that sits on the bubble in its ink for the fill', () => {
    // On a bubble you sent, a page role is the accent's own colour or near it: 1.5:1 at best.
    expect(row).not.toMatch(/tone=\{?["']?(secondary|tone\.)/)
    expect(row).not.toContain('$textSecondary')
    expect(row.match(/\{\.\.\.nameInk\}/g)).toHaveLength(2)
    expect(row).toContain('const nameInk = inkFor(tone.name, onAccent)')
    expect(row).toContain('{...inkFor(tone.caption, onAccent)}')
    expect(row).toContain("{...inkFor('secondary', onAccent)}")
    expect(row).toContain('{...inkFor(fileRowTone(state).control, onAccent)}')
    expect(row).toContain("color={onAccent ? '$onAccent' : '$primaryColor'}")
  })

  it('takes a press on the row apart from a press on its control', () => {
    // A picture's row opens it while its control exports it, so the two cannot share a handler.
    expect(rowPress).toContain('onPress,')
    expect(rowPress).not.toContain('onAction')
    expect(row).toMatch(/event\.stopPropagation\(\)\s*onAction\?\.\(\)/)
    expect(row).toMatch(/event\.stopPropagation\(\)\s*onOpen\(\)/)
  })

  it('names the row by the file and hints what its press does', () => {
    expect(rowPress).toContain("role: 'button' as const")
    expect(rowPress).toContain("'aria-label': filename")
    expect(rowPress).toContain('...pressHint(pressLabel)')
  })

  it('gives the row, its lead square and its control each a tab stop, in that order', () => {
    // Document order is tab order: the row wraps the square, and the control comes after both.
    expect(rowPress).toMatch(/\.\.\.keyboardPress\(\s*onPress,/)
    expect(leadPress).toMatch(/\.\.\.keyboardPress\(\s*onOpen,/)
    expect(control).toMatch(/\{\.\.\.keyboardPress\(onAction,/)
    expect(row.indexOf('...keyboardPress(\n              onPress')).toBeLessThan(
      row.indexOf('...keyboardPress(\n                    onOpen'),
    )
    expect(row.indexOf('{lead}')).toBeLessThan(row.indexOf('<Trailing'))
  })

  it('takes no tab stop for a progress ring or an absent control, which press nothing', () => {
    expect(control.indexOf('keyboardPress')).toBeGreaterThan(control.indexOf("'progress'"))
    expect(control.indexOf('keyboardPress')).toBeGreaterThan(control.indexOf('control === null'))
  })

  it('names the lead square and hints its press only while the press does something', () => {
    expect(leadPress).toContain("role: 'button' as const")
    expect(leadPress).toContain("'aria-label': filename")
    expect(leadPress).toContain('...pressHint(openLabel)')
  })

  it('gives the lead square an id of its own, which it carries before any picture is in it', () => {
    expect(row).toMatch(/group="tile"\s+cursor="pointer"\s+testID=\{testIDs\?\.lead\}/)
  })

  it('rings each focused part in the fill’s focus colour, the row clear of the parts it holds', () => {
    expect(rowPress).toContain("focusRing({ onAccent, offset: ROW_RING_OFFSET, radius: '$sm' })")
    expect(leadPress).toContain(
      'focusRing({ onAccent, offset: 0, radius: tileRadius(FILE_GLYPH_SIDE) })',
    )
    expect(control).toContain("focusRing({ onAccent, offset: 0, radius: '$full' })")
  })

  it('draws the row’s hover only where the row takes a press', () => {
    expect(row).toMatch(/\{onPress === undefined \? null : \(\s*<StateLayer group="row"/)
  })

  it('leaves the lead square on its own fill alone', () => {
    expect(row).toMatch(
      /backgroundColor="\$backgroundTertiary"\s*>\s*<Icon name=\{fileGlyph\(filename, contentType\)\} size="sm" color="\$textPrimary" \/>/,
    )
  })
})
