import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The host draws the whole stack inside one platform modal: on iOS nested ones are separate windows
 * that dismiss regardless of `backAction`. A source check, because nested modals render fine in
 * jsdom and wrongly only on a device.
 */
const source = readFileSync(join(import.meta.dirname, '../src/ModalStackHost.tsx'), 'utf8')

describe('ModalStackHost', () => {
  it('renders exactly one platform modal', () => {
    expect(source.match(/<NativeModal\b/g)).toHaveLength(1)
  })

  it('draws the layers inside it', () => {
    expect(source.indexOf('<NativeModal')).toBeLessThan(source.indexOf('entries.map('))
    expect(source.indexOf('entries.map(')).toBeLessThan(source.indexOf('</NativeModal>'))
  })

  it('leaves one level of back to the rules rather than closing everything', () => {
    // `onRequestClose` is Escape on the web and the hardware back button on Android.
    expect(source).toContain('onRequestClose={modals.back}')
    expect(source).not.toContain('onRequestClose={modals.dismissAll}')
  })
})
