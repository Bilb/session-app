import { expect, test, type Locator, type Page } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { DesktopApp } from '../harness/DesktopApp'
import { SEEDED_LIST, SEEDED_RTL_NAME } from '../harness/fixtures'

/** Arabic, which `isRtlLocale` answers true for and which the catalogue ships. */
const RTL_LOCALE = 'ar'

async function centreX(element: Locator): Promise<number> {
  const box = await element.boundingBox()
  if (box === null) throw new Error('not laid out')
  return box.x + box.width / 2
}

/** Which half of the window the element's centre sits in. */
async function horizontalHalf(page: Page, element: Locator): Promise<'left' | 'right'> {
  // Electron windows have no emulated viewport, so page.viewportSize() is null here.
  const width = await page
    .locator('html')
    .evaluate((html) => (html as unknown as { clientWidth: number }).clientWidth)
  return (await centreX(element)) > width / 2 ? 'right' : 'left'
}

/** Of two siblings, whether the row holding them mirrored, which the window's halves cannot say. */
async function isLeftOf(first: Locator, second: Locator): Promise<boolean> {
  return (await centreX(first)) < (await centreX(second))
}

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
test('choosing a right-to-left language mirrors the layout @desktop', async () => {
  const app = await DesktopApp.launch('alice', { env: { EXPO_PUBLIC_SESSION_NO_ACCOUNT: '1' } })

  try {
    const { page } = app
    const document = page.locator('html')
    const trigger = app.locator(ELEMENT.languagePicker.trigger).first()
    // The trigger's neighbour in the header's group of controls.
    const neighbour = app.locator(ELEMENT.onboarding.faqLink).first()
    await app.waitForVisible(ELEMENT.languagePicker.trigger, { timeoutMs: 20_000 })

    // Asserted before as well as after: a document that was already `rtl` would pass the second
    // check without the picker having done anything.
    await expect(document).not.toHaveAttribute('dir', 'rtl')
    const before = await horizontalHalf(page, trigger)
    expect(await isLeftOf(trigger, neighbour)).toBe(true)

    await trigger.click()
    await app.waitForVisible(ELEMENT.languagePicker.panel)
    await app.tap(ELEMENT.languagePicker.option(RTL_LOCALE))

    await expect(document).toHaveAttribute('dir', 'rtl')
    // `dir` changes whatever the layout does. Changing halves of the window shows the page's own
    // row mirrored; changing sides of its neighbour shows the header's row did too, which a
    // control pinned with `left` or `right` inside it would not.
    await expect.poll(async () => horizontalHalf(page, trigger)).not.toBe(before)
    await expect.poll(async () => isLeftOf(trigger, neighbour)).toBe(false)

    await app.screenshot('right-to-left')
  } finally {
    await app.close()
  }
})

/**
 * A filename reads in its own script's direction, whatever the layout's.
 *
 * In the default locale, where an Arabic name drawn left to right reads its tail first.
 */
test('reads each filename in its own script’s direction @desktop', async () => {
  const app = await DesktopApp.launch('alice')

  try {
    await openFirstConversation(app)
    const names = await app.readAllText(ELEMENT.conversation.attachmentName)
    expect(names).toContain(SEEDED_RTL_NAME)
    const name = app.locator(ELEMENT.conversation.attachmentName)
    await expect(name.nth(names.indexOf(SEEDED_RTL_NAME))).toHaveCSS('direction', 'rtl')
    await expect(name.nth(names.indexOf(SEEDED_LIST[0]))).toHaveCSS('direction', 'ltr')
  } finally {
    await app.close()
  }
})
