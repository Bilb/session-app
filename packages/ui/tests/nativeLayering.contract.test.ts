import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Arrangements that only fail on a device, held by reading the source.
 *
 * Each of these draws correctly in a browser and in every unit test the package has, which is why
 * a grep is the check: `packages/ui` has no native renderer to test them in, and the failure on a
 * phone is a picture that never shows, a control under the status bar, or a list that will not
 * scroll. The fast e2e tier is Electron, where none of them reproduce.
 */
function source(file: string): string {
  return readFileSync(join(import.meta.dirname, '../src', file), 'utf8')
}

/** The props of the first JSX element opening at `marker`, up to its closing `>`. */
function openingTag(text: string, marker: string): string {
  const start = text.indexOf(marker)
  expect(start).toBeGreaterThanOrEqual(0)
  return text.slice(start, text.indexOf('>\n', start))
}

describe('an attachment tile', () => {
  const tile = source('AttachmentTile.tsx')

  it('keeps its clipping view the same as the picture lands', () => {
    // On Android a border dropped from an `overflow: hidden` view as its image loads leaves the
    // tile blank, so nothing on the clipping view may depend on whether the picture has arrived.
    const root = openingTag(tile, '<YStack\n      position="relative"')
    expect(root).toContain('overflow="hidden"')
    expect(root).not.toMatch(/\bhere\b|borderWidth/)
  })

  it('draws its hairline as a layer of its own', () => {
    expect(tile).toMatch(/borderWidth=\{TILE_HAIRLINE_WIDTH\}[\s\S]*?pointerEvents="none"/)
  })
})

describe('the media viewer', () => {
  const viewer = source('MediaViewer.tsx')

  it('keeps its chrome inside the safe area, since a modal is drawn edge to edge on Android', () => {
    expect(viewer).toMatch(/<SafeArea>[\s\S]*icon="x"/)
  })

  it('lays the chevrons over the picture\u2019s own box, so they centre on the picture', () => {
    const box = viewer.indexOf('onLayout=')
    const chevrons = viewer.indexOf('testID={previousTestID}')
    const header = viewer.indexOf('testID={exportTestID}')
    expect(box).toBeGreaterThan(header)
    expect(chevrons).toBeGreaterThan(box)
  })

  it('offers no control that does nothing', () => {
    expect(viewer).not.toContain('ellipsis')
  })

  it('gives both chevrons a backdrop of their own, since they sit on the picture', () => {
    expect(viewer.match(/overMedia\n/g)?.length).toBe(2)
  })
})

describe('a sheet', () => {
  const sheet = source('Sheet.tsx')

  it('closes from its scrim, and claims no press on anything around its body', () => {
    // A press handler on an ancestor of the scroller holds every touch that starts in the sheet,
    // and a slow drag then never becomes a scroll. The two handlers are the scrim's and the close
    // button's, and the scrim is a sibling of the surface rather than its parent.
    expect(sheet.match(/onPress=/g)?.length).toBe(2)
    expect(sheet).not.toContain('stopPropagation')
    expect(sheet).toMatch(
      /<YStack fullscreen backgroundColor="\$surfaceInk"[^>]*onPress=\{onClose\}/,
    )
  })
})

describe('a native screen', () => {
  it('wraps its content in no touchable, so a list inside can start a scroll', () => {
    const screen = source('Screen.native.tsx')
    expect(screen).not.toMatch(/<(Touchable\w*|Pressable)\b/)
    expect(screen).toContain('backgroundDismissResponder')
  })
})

describe('a native screen', () => {
  it('keeps the keyboard-avoiding view directly in the inset frame', () => {
    // It measures its offset from its parent: under a wrapper it misses the top inset, and lifts
    // the composer short of the keyboard by exactly that much.
    const text = source('Screen.native.tsx')
    const avoiding = text.indexOf('<KeyboardAvoidingView')
    expect(avoiding).toBeGreaterThanOrEqual(0)
    expect(text.slice(text.indexOf('return ('), avoiding)).not.toMatch(/<View\b/)
  })
})
