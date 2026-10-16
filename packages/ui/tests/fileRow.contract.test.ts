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
  // The same for the lead square, whose spread `openLabel` and the platform switch on.
  const leadPress =
    /\{\.\.\.\(openLabel === undefined \|\| !isWeb\s*\?\s*\{\}\s*:\s*\{([\s\S]*?)\}\)\}/.exec(
      row,
    )?.[1] ?? ''
  const control = row.slice(
    row.indexOf('function Trailing('),
    row.indexOf('export function FileRow('),
  )
  const nativeButton = row.slice(
    row.indexOf('function nativeRowElement('),
    row.indexOf('function Trailing('),
  )
  // The row's own stack, up to the first thing it holds.
  const rowStack =
    /<XStack\s+alignItems="center"\s+gap=\{FILE_ROW_GAP\}[\s\S]*?\n {4}>/.exec(row)?.[0] ?? ''

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
    expect(rowPress).toMatch(/\bonPress\b/)
    expect(rowPress).not.toContain('onAction')
    expect(row).toMatch(/event\.stopPropagation\(\)\s*onAction\?\.\(\)/)
    expect(row).toMatch(/event\.stopPropagation\(\)\s*onOpen\(\)/)
  })

  it('is no button on the web, where it would hold the lead square’s and the control’s', () => {
    // ARIA makes a button's children presentational, so a screen reader may skip both.
    expect(rowStack).toContain('{...nativeRowElement({')
    expect(nativeButton.indexOf('if (isWeb) return {}')).toBeGreaterThan(-1)
    expect(nativeButton.indexOf('if (isWeb) return {}')).toBeLessThan(
      nativeButton.indexOf("role: 'button'"),
    )
    for (const prop of [
      "role: '",
      "'aria-label'",
      'aria-description',
      'pressHint(',
      'aria-disabled',
    ])
      expect(rowStack).not.toContain(prop)
  })

  it('takes the pointer on the web and nothing from the keyboard', () => {
    expect(rowPress.replace(/\s+/g, ' ').trim()).toBe("cursor: 'pointer', onPress")
    for (const prop of [
      'keyboardPress',
      'heldButton',
      'tabIndex',
      'focusVisibleStyle',
      'onKeyDown',
    ])
      expect(rowStack).not.toContain(prop)
    expect(row).not.toContain('rowRing')
  })

  it('is the one accessibility element on native, named by the file and its caption', () => {
    // iOS hides whatever an accessibility element holds, so the row speaks for the whole of it.
    expect(nativeButton).toContain('accessible: true')
    expect(nativeButton).toContain("...(pressable || held ? { role: 'button' } : {})")
    expect(nativeButton).toContain("'aria-label': name")
    expect(nativeButton).toContain('...(pressable ? pressHint(pressLabel) : {})')
    expect(rowStack).toContain('name: fileRowAccessibleName(filename, format, caption)')
  })

  it('offers the lead square’s and the control’s verbs as the row’s actions on native', () => {
    expect(nativeButton).toContain('accessibilityActions: actions.map(')
    expect(nativeButton).toMatch(
      /onAccessibilityAction:[\s\S]*actions\.find\(\(action\) => action\.name === event\.nativeEvent\.actionName\)\?\.run\(\)/,
    )
    expect(row).toMatch(/fileRowActions\(\{\s*onPress,\s*pressLabel,\s*onOpen,\s*openLabel,/)
    // A held or absent control presses nothing, so it is no action either.
    expect(row).toContain(
      "onAction: control === null || control === 'progress' ? undefined : onAction",
    )
  })

  it('gives the lead square and the control no role of their own on native', () => {
    // A button inside the row's element would be hidden on iOS, or read twice on Android.
    expect(row).toContain('{...(openLabel === undefined || !isWeb')
    expect(row).toContain('{...(leadHeld && isWeb ? heldButton(filename, leadRing) : {})}')
    expect(control).toMatch(/\{\.\.\.\(!isWeb\s*\?\s*\{\}\s*:\s*held/)
    expect(control.indexOf('!isWeb')).toBeLessThan(control.indexOf("role: 'button'"))
  })

  it('keeps every part addressable by id, which the row being one element does not change', () => {
    for (const id of ['row', 'name', 'caption', 'lead', 'thumbnail'])
      expect(row).toContain(`testID={testIDs?.${id}}`)
    expect(row).toContain('testID={testIDs?.action}')
    expect(control).toContain('testID={testID}')
  })

  it('gives its lead square and its control each a tab stop, in that order', () => {
    // Document order is tab order: the control comes after the square.
    expect(leadPress).toContain('...keyboardPress(onOpen, leadRing)')
    expect(control).toContain('...keyboardPress(onAction, ring)')
    expect(row.indexOf('{lead}')).toBeLessThan(row.indexOf('<Trailing'))
  })

  it('takes no tab stop for an absent control, which presses nothing', () => {
    expect(control.indexOf('keyboardPress')).toBeGreaterThan(control.indexOf('control === null'))
  })

  it('keeps the square and the control disabled stops while fetching, so focus stays', () => {
    // One element in every state: swapping the focused one for another drops focus to the page.
    expect(row).toContain("const held = state === 'fetching'")
    expect(row).toContain('{...(leadHeld && isWeb ? heldButton(filename, leadRing) : {})}')
    expect(control).toContain("const held = control === 'progress'")
    expect(control).toContain('? heldButton(actionLabel, ring)')
    // Set in every state: Android keeps a disabled state that is dropped rather than cleared.
    expect(control).toContain("{...(isWeb ? { 'aria-disabled': held } : {})}")
    expect(nativeButton).toContain("'aria-disabled': !pressable && held")
    expect(row).toContain("{...(isWeb ? { 'aria-disabled': leadHeld } : {})}")
    expect(control.match(/<YStack\b/g)).toHaveLength(2)
    // tamagui remounts a view whose group comes or goes, so the row's is unconditional.
    expect(rowPress).not.toContain('group')
    expect(row).toMatch(/position="relative"\s*\/\/[^\n]*\n\s*group="row"/)
  })

  it('names the lead square and hints its press only while the press does something', () => {
    expect(leadPress).toContain("role: 'button' as const")
    expect(leadPress).toContain("'aria-label': filename")
    expect(leadPress).toContain('...pressHint(openLabel)')
  })

  it('gives the lead square an id of its own, which it carries before any picture is in it', () => {
    expect(row).toMatch(/group="tile"\s+cursor="pointer"\s+testID=\{testIDs\?\.lead\}/)
  })

  it('rings each focused part in the fill’s focus colour', () => {
    expect(row).toContain('focusRing({ onAccent, offset: 0, radius: tileRadius(FILE_GLYPH_SIDE) })')
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
