import { expect } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { sessionTest } from '../harness/sessionTest'

/**
 * The flow the whole architecture exists to serve: see the conversations, open one, say
 * something, watch it appear.
 *
 * It is written against ISessionApp and addresses everything by its id from the registry,
 * so the day the mobile drivers land this same spec runs on them by changing one line in
 * the clients descriptor.
 */
sessionTest({
  title: 'reads the conversation list, opens one and sends a message',
  risk: 'high',
  clients: { alice: 'desktop' },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')

    await alice.waitForVisible(ELEMENT.conversationList.screen)

    // Address by id, then assert the copy: the row keeps its id through a rename, so a
    // failure here is about the text rather than about finding the element.
    const names = await alice.readAllText(ELEMENT.conversationList.rowName)
    expect(names).toContain('Bob')

    await alice.tap(ELEMENT.conversationList.row(0))
    await alice.waitForVisible(ELEMENT.conversation.screen)
    expect(await alice.readText(ELEMENT.conversation.headerName)).toBe('Bob')

    const seeded = await alice.readAllText(ELEMENT.conversation.messageBody)
    expect(seeded.length).toBeGreaterThan(0)

    await alice.type(ELEMENT.conversation.composerInput, 'Hello from the walking skeleton')
    await alice.tap(ELEMENT.conversation.sendButton)

    // libsession stores the row before the send completes, so it is on screen immediately
    // rather than after a round trip - no optimistic copy was involved.
    await expect
      .poll(async () => alice.readAllText(ELEMENT.conversation.messageBody), { timeout: 10_000 })
      .toContain('Hello from the walking skeleton')

    await alice.screenshot('walking-skeleton-desktop')
  },
})
