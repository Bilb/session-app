import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ALBUM_SEAM } from '#src/albumLayout'
import { focusRing } from '#src/keyboardPress'

/**
 * What a test and a screen reader can ask of the attachment controls, held by reading the source.
 *
 * A grep rather than a render test: `packages/ui` renders nothing in its unit tier, and the
 * failures here are in the native accessibility tree - an id on a node the tree hides, or a state
 * the face never exposes - which no browser shows either.
 */
function source(file: string): string {
  return readFileSync(join(import.meta.dirname, '../src', file), 'utf8')
}

describe('the album’s download cloud', () => {
  const hint = source('FetchHint.tsx')
  // Everything a pressable cloud carries is in the one spread that `onPress` switches on.
  const pressable =
    /onPress === undefined\s*\?\s*\{\}\s*:\s*\{([\s\S]*?)\}\)\}/.exec(hint)?.[1] ?? ''

  it('is the set’s named control where it takes the press', () => {
    expect(pressable).toContain("role: 'button'")
    expect(pressable).toContain("'aria-label': label")
    expect(pressable).toContain('testID')
  })

  it('is an accessibility element on iOS, which tamagui makes only a stack with tabIndex 0', () => {
    expect(pressable).toContain('isWeb ? {} : { tabIndex: 0 }')
  })

  it('is not hidden from the tree its id is looked up in', () => {
    expect(hint).not.toContain('aria-hidden')
  })
})

describe('the three-up’s cloud', () => {
  const album = source('AttachmentAlbum.tsx')

  it('takes a press, and leaves the tile under the rest of its box its own', () => {
    // `none` on the box excludes the whole subtree on native, so the cloud's press never fired.
    expect(album).not.toContain('pointerEvents="none"')
    expect(album).toMatch(
      /<XStack position="absolute"[^>]*pointerEvents="box-none">\s*<YStack[^>]*pointerEvents="box-none"/,
    )
  })

  it('sits over the tile that fetches', () => {
    expect(album).toContain('cellPlace(layout, fetchAt)')
  })
})

describe('an album tile', () => {
  const album = source('AttachmentAlbum.tsx')
  const tile = album.slice(album.indexOf('const AlbumTile'), album.indexOf('export function'))

  it('is named for a screen reader, and is a button only while its press does something', () => {
    expect(tile).toContain("'aria-label': name")
    expect(tile).toContain("role: item.hint === undefined ? ('img' as const) : ('button' as const)")
    expect(tile).toContain('{...pressHint(item.hint)}')
  })

  it('takes a tab stop and keys while its press does something', () => {
    expect(tile).toContain(
      'keyboardPress(held || item.hint === undefined ? undefined : press, ring)',
    )
  })

  it('stays a disabled button with its tab stop while it transfers, so focus on it stays', () => {
    expect(tile).toMatch(/\{\.\.\.\(held\s*\?\s*heldButton\(name, ring\)\s*:\s*\{\s*role:/)
    // Set in every state: Android keeps a disabled state that is dropped rather than cleared.
    expect(tile).toContain('aria-disabled={held}')
  })

  it('is a hover group in every state, since tamagui remounts a view whose group comes or goes', () => {
    expect(tile).toMatch(/\n\s*group="tile"\n/)
    expect(tile).not.toContain("group: 'tile'")
  })

  it('keeps its press on touch in every state but a running transfer', () => {
    expect(tile).toContain('onPress={held ? undefined : press}')
  })

  it('is an accessibility element on iOS, so VoiceOver reads its name', () => {
    expect(tile).toContain('isWeb ? {} : { tabIndex: 0 }')
  })

  it('carries its own test id, since on iOS it hides the picture’s', () => {
    expect(tile).toContain('testID={testID}')
    expect(album.match(/testID=\{tileTestID\}/g)).toHaveLength(2)
  })

  it('rings itself in the seam, in the fill’s focus colour, where its own layers cannot cover it', () => {
    expect(tile).toContain(
      'const ring = focusRing({ onAccent, offset: 0, radius: tileRadius(side) })',
    )
    expect(album.match(/onAccent=\{onAccent\}/g)).toHaveLength(2)
    // Wider than the seam, the ring would reach the next tile, which paints over it.
    expect(focusRing({ onAccent: false, offset: 0, radius: 0 }).outlineWidth).toBeLessThanOrEqual(
      ALBUM_SEAM,
    )
  })

  it('names the tile under the overflow by what the overflow says, on whichever tile it is', () => {
    expect(album).toContain('at === overflowAt ? overflowName(label, layout.overflow) : label')
    expect(album.match(/name=\{nameOf\((cell\.at|layout\.lead\.at)\)\}/g)).toHaveLength(2)
  })
})
