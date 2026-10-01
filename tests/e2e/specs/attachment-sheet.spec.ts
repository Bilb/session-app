import { expect } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { SEEDED_LIST, SEEDED_ROLL } from '../harness/fixtures'
import { sessionTest } from '../harness/sessionTest'

// @session/screens' LIST_MAX_ROWS: importing screens would pull react-native into Playwright.
const LIST_MAX_ROWS = 5

/**
 * A set longer than the transcript will hold.
 *
 * A few rows and then a way to the rest, rather than every row for the reader to scroll past to
 * reach whatever was said next. The sheet holds the same rows and the same footer, so nothing is
 * only reachable from one of the two.
 */
sessionTest({
  title: 'moves a long set of attachments into a sheet',
  risk: 'low',
  clients: { alice: 'desktop' },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')

    await openFirstConversation(alice)

    // Every row of the short list and the first few of the roll; the album names nothing.
    const inTranscript = SEEDED_LIST.length + LIST_MAX_ROWS
    await expect
      .poll(async () => alice.count(ELEMENT.conversation.attachmentName), { timeout: 10_000 })
      .toBe(inTranscript)
    expect(await alice.count(ELEMENT.conversation.attachmentShowAll)).toBe(1)

    await alice.tap(ELEMENT.conversation.attachmentShowAll)
    await alice.waitForVisible(ELEMENT.conversation.attachmentSheet)

    // The whole roll over the transcript still drawn behind it, and the footer that acts on it.
    await expect
      .poll(async () => alice.count(ELEMENT.conversation.attachmentName), { timeout: 5_000 })
      .toBe(inTranscript + SEEDED_ROLL.length)
    expect(await alice.isVisible(ELEMENT.conversation.attachmentFooter)).toBe(true)

    await alice.screenshot('attachment-sheet-desktop')

    await alice.tap(ELEMENT.conversation.attachmentSheetClose)
    await expect
      .poll(async () => alice.isVisible(ELEMENT.conversation.attachmentSheet), { timeout: 5_000 })
      .toBe(false)
  },
})
