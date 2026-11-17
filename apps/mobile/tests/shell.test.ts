/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Held by reading the source: the shell is a navigator choice, and this tier renders nothing.
 */
const shell = readFileSync(join(import.meta.dirname, '../src/shell.tsx'), 'utf8')

describe('the mobile shell', () => {
  it('routes through a native stack, so a phone pushes screens and swipes back', () => {
    expect(shell).toMatch(/<Stack\b/)
    expect(shell).not.toMatch(/<Slot\b/)
  })

  it('pushes and swipes back only with one pane: beside the list the detail changes in place', () => {
    expect(shell).toContain("animation: twoPanes ? 'none' : 'default'")
    // The swipes too: with no animation they would still pop, back to the empty pane.
    expect(shell).toContain('gestureEnabled: !twoPanes')
    // Which covers iOS 26's full-screen swipe. Setting that one would replace the native
    // edge swipe with a custom recognizer on iOS 18 and earlier.
    expect(shell).not.toMatch(/fullScreenGestureEnabled:/)
  })
})
