import { expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { DesktopApp } from '../harness/DesktopApp'

/** Arabic, which `isRtlLocale` answers true for and which the catalogue ships. */
const RTL_LOCALE = 'ar'

/**
 * Choosing a right-to-left language mirrors the layout, not just the text.
 *
 * `applyDirection` writes `dir` on the document element and everything below follows from that --
 * flex rows reverse, logical edges swap, and the components that have to ask read `isLayoutRtl()`.
 * None of it is observable from a unit test: `packages/ui` has no document, and the whole point is
 * what the browser does with one attribute.
 *
 * It sits here rather than beside a feature because it is the standing check. A component that
 * places something with `left` instead of `insetInlineStart` looks correct in every English
 * screenshot ever taken of it, and this is the run where that shows up.
 *
 * Launched directly rather than through `sessionTest`, which has no way to pass the environment
 * that opens the app on onboarding, where the language picker is.
 */
test('choosing a right-to-left language mirrors the layout', async () => {
  const app = await DesktopApp.launch('alice', { env: { SESSION_FAKE_NO_ACCOUNT: '1' } })

  try {
    const trigger = ELEMENT.languagePicker.trigger
    await app.waitForVisible(trigger, { timeoutMs: 20_000 })

    // Asserted before as well as after: a document that was already `rtl` would pass the second
    // check without the picker having done anything.
    expect(await app.documentDirection()).not.toBe('rtl')
    const before = await app.horizontalHalf(trigger)

    await app.tap(trigger)
    await app.waitForVisible(ELEMENT.languagePicker.panel)
    await app.tap(ELEMENT.languagePicker.option(RTL_LOCALE))

    await expect.poll(async () => app.documentDirection()).toBe('rtl')
    // `dir` stays correct for an element placed with a physical edge; the trigger changing sides
    // is the layout itself mirroring.
    await expect.poll(async () => app.horizontalHalf(trigger)).not.toBe(before)

    await app.screenshot('right-to-left')
  } finally {
    await app.close()
  }
})
