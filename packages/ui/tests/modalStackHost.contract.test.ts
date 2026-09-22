import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The host draws the whole stack inside **one** platform modal.
 *
 * Presenting a second react-native `Modal` from inside the first is the obvious way to stack them
 * and it takes the decision away from us: on iOS each one is a separate window, so the two animate
 * independently, their scrims multiply, and dismissing the outer takes the inner with it whatever
 * `backAction` says. One window is what leaves `modalStack.ts` in charge of what closes.
 *
 * A grep rather than a render test because the failure is a platform behaviour jsdom does not have:
 * nested modals render perfectly well in a test and wrongly on a device, which is exactly the class
 * of regression a render test cannot see.
 */
const source = readFileSync(join(import.meta.dirname, '../src/ModalStackHost.tsx'), 'utf8')

describe('ModalStackHost', () => {
  it('renders exactly one platform modal', () => {
    expect(source.match(/<NativeModal\b/g)).toHaveLength(1)
  })

  it('draws the layers inside it', () => {
    // With exactly one above, this is what says the stack is *within* it rather than beside it:
    // the modal opens before the map and closes after it.
    expect(source.indexOf('<NativeModal')).toBeLessThan(source.indexOf('entries.map('))
    expect(source.indexOf('entries.map(')).toBeLessThan(source.indexOf('</NativeModal>'))
  })

  it('leaves one level of back to the rules rather than closing everything', () => {
    // `onRequestClose` is Escape on the web and the hardware button on Android. Wiring it to
    // `dismissAll`, or to dismissing the top entry directly, is what makes a deep settings tree
    // collapse from a stray key press.
    expect(source).toContain('onRequestClose={modals.back}')
    expect(source).not.toContain('onRequestClose={modals.dismissAll}')
  })
})
