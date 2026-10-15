import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')

/** What the composer's staging draws that a screen reader and a mirrored layout depend on. */
describe('the staged tray', () => {
  it('names each tile and says which file its remove button takes out', () => {
    const tile = source('StagedTile.tsx')
    // On the face beside the button, not on the tile around it, which would swallow the button.
    expect(tile).toMatch(/<YStack flex=\{1\} role="img" aria-label=\{label\}>/)
    expect(tile).not.toContain('role="group"')
    expect(tile).toContain('accessibilityLabel={removeLabel}')
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

  it('is announced on every platform, once per refusal', () => {
    expect(notice).toContain('role="alert"')
    expect(notice).toContain('AccessibilityInfo.announceForAccessibility')
    expect(notice).toMatch(/\}, \[announceKey\]\)/)
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
