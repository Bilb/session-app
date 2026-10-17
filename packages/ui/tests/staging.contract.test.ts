import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

/** What the composer's staging draws that a screen reader and a mirrored layout depend on. */
describe('the staged tray', () => {
  it('names each tile and says which file its remove button takes out', () => {
    const tile = source('StagedTile.tsx')
    // On the face beside the button, not on the tile around it, which would swallow the button.
    expect(tile).toMatch(
      /<YStack flex=\{1\} role="img" aria-label=\{label\} \{\.\.\.NATIVE_ELEMENT\}>/,
    )
    expect(tile).not.toContain('role="group"')
    expect(tile).toContain('accessibilityLabel={removeLabel}')
  })

  it('is one element to a native screen reader, read by its label alone', () => {
    const tile = source('StagedTile.tsx')
    expect(tile).toContain('const NATIVE_ELEMENT = isWeb ? {} : { accessible: true }')
    expect(tile).not.toContain('tabIndex')
    // Hidden under the label, so the name's two runs are not read as two words.
    expect(tile).toContain(
      '<YStack flex={1} padding="$xs" paddingTop="$sm" gap="$2xs" aria-hidden>',
    )
  })

  it('lines the name and its size up on the edge the name starts from, and only those', () => {
    expect(source('StagedTile.tsx')).toMatch(
      /<YStack gap="\$2xs" style=\{\{ direction: nameDirection\(name\) \}\}>\s+<FileName/,
    )
  })

  it('pages a right-to-left rail the way Chromium counts it', () => {
    const tray = source('StagedTray.tsx')
    expect(tray).toContain('offset: Math.abs(contentOffset.x)')
    expect(tray).toContain('x: isLayoutRtl() ? -x : x')
    // The buttons sit at the reading edges, not at left and right.
    expect(tray).toContain('logical({ insetStart: 0 })')
    expect(tray).toContain('logical({ insetEnd: 0 })')
  })
})

describe('a composer notice', () => {
  const notice = source('ComposerNotice.tsx')
  const announcement = source('Announcement.tsx')

  it('is drawn only, leaving what is said to one announcement for all of them', () => {
    expect(notice).not.toContain('role="alert"')
    expect(notice).not.toContain('announceForAccessibility')
  })

  it('is said once per refusal on every platform, the same words twice included', () => {
    expect(announcement).toContain('AccessibilityInfo.announceForAccessibility(said.text)')
    expect(announcement).toMatch(/\}, \[said\]\)/)
    expect(announcement).toContain(
      'if (said.key !== announceKey) setSaid({ key: announceKey, text })',
    )
    // A live region whose words do not change is not announced again, so the web remounts it.
    expect(announcement).toMatch(/key=\{said\.key\}\s+role="alert"/)
  })

  it('lets go of its words once every notice is gone, so a reader browsing finds none', () => {
    expect(announcement).toContain(
      "else if (text === '' && said.text !== '') setSaid({ key: announceKey, text })",
    )
  })

  it('keeps its words off the danger colour, which fails 4.5:1 on the composer in dark themes', () => {
    expect(notice).not.toMatch(/<Text[^>]*\$dangerColor/)
    expect(notice).toContain('<Icon name="triangleAlert" size="sm" color="$dangerColor" />')
  })
})

describe('the drop overlay', () => {
  it('outlines in the accent text, which keeps 3:1 on its tint in the light themes', () => {
    expect(source('DropOverlay.tsx')).toContain('borderColor="$accentText"')
  })
})
