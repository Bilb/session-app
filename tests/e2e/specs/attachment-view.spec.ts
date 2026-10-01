import { expect } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { SEEDED_ALBUM, SEEDED_LIST } from '../harness/fixtures'
import { openFirstConversation } from '../harness/attachments'
import { sessionTest } from '../harness/sessionTest'

/**
 * Reading a set of photographs as rows, because somebody asked to.
 *
 * Not a failure fallback: nothing has gone wrong here, the set draws perfectly well as an album,
 * and the reader wants the names and the sizes instead.
 *
 * The conversation holds three attachment messages, oldest first: an album of two photographs,
 * which names nothing; a picture and a document, a list from the start; and a roll with a
 * document in it, also a list. Only the album offers the toggle - with a document in the set the
 * gallery is impossible rather than unwanted. So before the toggle the first names on screen are
 * the picture-and-document list's, and after it the album's come ahead of them.
 *
 * That the choice survives the row being unmounted is not asserted here: the transcript is a
 * windowed list and scrolling one far enough to recycle a row is the kind of step that passes
 * for the wrong reason. `ConversationScreen` holding the record rather than the row is the
 * durable statement of it.
 */
sessionTest({
  title: 'reads a gallery as a list when asked',
  risk: 'low',
  clients: { alice: 'desktop' },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')

    await openFirstConversation(alice)

    expect(await alice.count(ELEMENT.conversation.attachmentViewGallery)).toBe(1)

    const before = await alice.readAllText(ELEMENT.conversation.attachmentName)
    expect(before.slice(0, SEEDED_LIST.length)).toEqual(SEEDED_LIST)

    await alice.tap(ELEMENT.conversation.attachmentViewList)
    const expected = [...SEEDED_ALBUM, ...SEEDED_LIST]
    await expect
      .poll(
        async () =>
          (await alice.readAllText(ELEMENT.conversation.attachmentName)).slice(0, expected.length),
        { timeout: 5_000 },
      )
      .toEqual(expected)

    await alice.screenshot('attachment-view-list-desktop')
  },
})
