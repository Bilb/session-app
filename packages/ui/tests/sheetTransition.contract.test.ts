import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const sheet = readFileSync(join(import.meta.dirname, '../src/Sheet.tsx'), 'utf8')

/** Held by reading the source: `packages/ui` has no native renderer to watch a transition on. */
describe('a sheet opening', () => {
  it('leaves the modal still, since its own slide carries the scrim up with the sheet', () => {
    expect(sheet).toContain('animationType="none"')
    expect(sheet).not.toMatch(/animationType=\{[^}]*'slide'/)
  })

  it('fades the scrim in place and slides only the sheet on a phone', () => {
    expect(sheet).toMatch(
      /<Animated\.View style=\{\[StyleSheet\.absoluteFill, \{ opacity: progress \}\]\}>\s*<YStack\s+fullscreen\s+backgroundColor="\$scrim"/,
    )
    expect(sheet).toContain('outputRange: [windowHeight, 0]')
  })

  it('stays mounted until it has left', () => {
    expect(sheet).toContain('if (finished && !open) setShown(false)')
    expect(sheet).toContain('<NativeModal visible={shown}')
  })
})
