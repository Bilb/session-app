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
      /<YStack\s+flex=\{1\}\s+role="img"\s+aria-label=\{label\}\s+\{\.\.\.NATIVE_ELEMENT\}/,
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
    // The picture has no text to hide, and hiding it would take its test id with it on Android.
    expect(tile).toMatch(/opacity=\{shown \? 1 : 0\}\s*>/)
  })

  it('carries the picture’s test id on the face on iOS, where the face hides the picture', () => {
    const tile = source('StagedTile.tsx')
    expect(tile).toContain(
      "testID={Platform.OS === 'ios' && preview !== undefined ? previewTestID : undefined}",
    )
    // Android and the web reach the picture itself, so it keeps the id there.
    expect(tile).toContain('testID={previewTestID}')
  })

  it('draws the remove disc on the page surface with a shadow, which shows on any picture', () => {
    expect(source('StagedTile.tsx')).toMatch(
      /backgroundColor="\$backgroundPrimary"\s+shadowColor="\$shadow"/,
    )
  })

  it('rings the remove disc itself, inside the tile, and shows its hover and press', () => {
    const tile = source('StagedTile.tsx')
    // The tile clips to its rounded corner, which would cut a ring drawn around the corner square.
    expect(tile).toContain('ring={REMOVE_RING}')
    expect(tile).toContain('offset: -((REMOVE_TARGET - REMOVE_DISC) / 2 - 2)')
    expect(tile).toMatch(/alignItems="center"\s+justifyContent="center"\s+group="control"/)
    expect(tile).toContain(
      '<DiscState color="$hoverOverlay" on={hovered && !pressed} when="hover" />',
    )
    expect(tile).toContain('<DiscState color="$pressedOverlay" on={pressed} when="press" />')
  })

  it('fades only the ends that can still scroll, into the surface, in the reading direction', () => {
    const tray = source('StagedTray.tsx')
    expect(tray).toMatch(
      /\{startFade > 0 \? \(\s*<YStack[^>]*opacity=\{startFade\}[^>]*\{\.\.\.logical\(\{ insetStart: 0 \}\)\}>/,
    )
    expect(tray).toMatch(
      /\{endFade > 0 \? \(\s*<YStack[^>]*opacity=\{endFade\}[^>]*\{\.\.\.logical\(\{ insetEnd: 0 \}\)\}>/,
    )
    const fade = source('TrayEdgeFade.tsx')
    expect(fade).toContain("useTokenColor('$backgroundPrimary')")
    expect(fade).toContain("const opaqueAtZero = (side === 'start') !== isLayoutRtl()")
  })

  it('says its count as words, which "3 / 32" is not', () => {
    const tray = source('StagedTray.tsx')
    expect(tray).toContain("isWeb ? { 'aria-hidden': true } : { 'aria-label': countSpokenLabel }")
    expect(tray).toMatch(/style=\{VISUALLY_HIDDEN\}>\s*\{countSpokenLabel\}/)
  })

  it('lines the name and its size up on the edge the name starts from, and only those', () => {
    expect(source('StagedTile.tsx')).toMatch(
      /<YStack gap="\$2xs" style=\{\{ direction: nameDirection\(name\) \}\}>\s+<FileName/,
    )
  })

  it('keeps the document face under its thumbnail', () => {
    const tile = source('StagedTile.tsx')
    expect(tile).toContain('<DocumentFace name={name}')
    expect(tile).toContain('opacity={shown ? 1 : 0}')
  })

  it('says Clear and each remove button are disabled when they are, and draws them so', () => {
    expect(source('StagedTray.tsx')).toMatch(/disabled=\{clearDisabled\}\s+onPress=\{onClear\}/)
    const tile = source('StagedTile.tsx')
    expect(tile).toMatch(/onPress=\{onRemove\}\s+disabled=\{removeDisabled\}/)
    expect(tile).toMatch(/color="\$textPrimary"\s+opacity=\{removeDisabled \? 0\.35 : 1\}/)
    expect(tile).not.toContain('$textDisabled')
  })

  it('scrolls by its scrollbar, and a right-to-left rail the way Chromium counts it', () => {
    const tray = source('StagedTray.tsx')
    expect(tray).toMatch(/horizontal\s+showsHorizontalScrollIndicator\s/)
    expect(tray).toContain('x: isLayoutRtl() ? -startOffset : startOffset')
    expect(tray).toContain('left: isLayoutRtl() ? -event.deltaY : event.deltaY')
  })
})

describe('a composer notice', () => {
  const notice = source('ComposerNotice.tsx')
  const announcement = source('Announcement.tsx')

  it('shortens a file name in its detail as a file row does, keeping the extension', () => {
    expect(notice).toContain('<FileName name={name} size="$label" weight="regular"')
    expect(notice).toContain('style={{ direction: nameDirection(detail) }}')
    // Its own direction inside, the layout's start edge outside, so it sits under the message.
    expect(notice).toMatch(/alignSelf="flex-start"\s+maxWidth="100%"/)
  })

  it('is drawn only, leaving what is said to one announcement for all of them', () => {
    expect(notice).not.toContain('role="alert"')
    expect(notice).not.toContain('announceForAccessibility')
  })

  it('is said once per refusal on every platform, the same words twice included', () => {
    expect(announcement).toContain(
      'return scheduleAnnouncement(said.text, Platform.OS, AccessibilityInfo)',
    )
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
    expect(notice).not.toMatch(/<Text[^>]*\$danger(Color|Text)/)
    expect(notice).toContain('<Icon name="triangleAlert" size="sm" color="$dangerColor" />')
  })
})

describe('a drop zone that is not accepting', () => {
  const zone = source('DropZone.tsx')

  it('draws no overlay, shows a no-entry cursor and takes nothing dropped', () => {
    expect(zone).toContain(
      'if (depth === 1 && handlers.current.accepting) handlers.current.onActive(true)',
    )
    expect(zone).toContain("dropEffect = handlers.current.accepting ? 'copy' : 'none'")
    expect(zone).toMatch(/if \(!handlers\.current\.accepting\) return\s+const \{ files, folders \}/)
  })
})

describe('the drop overlay', () => {
  it('outlines in the accent text, which keeps 3:1 on its tint in the light themes', () => {
    expect(source('DropOverlay.tsx')).toContain('borderColor="$accentText"')
  })

  it('wraps its words centred and clear of the outline on a narrow window', () => {
    const overlay = source('DropOverlay.tsx')
    expect(overlay).toContain('paddingHorizontal="$lg"')
    expect(overlay.match(/textAlign="center"/g)).toHaveLength(2)
  })
})
