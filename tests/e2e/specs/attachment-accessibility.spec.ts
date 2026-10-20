import {
  ALBUM_TILE_ID,
  ATTACHMENT_ROW_IDS,
  albumTile,
  attachmentFooterAction,
  FETCH_HINT_ID,
  fetchHint,
  fileRow,
  FOOTER_ACTION_ID,
  pressArea,
  setFetchName,
  verbName,
} from '@session/expectations'
import { expect } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import type { ISessionApp } from '../harness/ISessionApp'
import { expectDescribed } from '../harness/expected'
import { SEEDED_ALBUM, SEEDED_LIST, SEEDED_RECEIPT } from '../harness/fixtures'
import { EACH, sessionTest } from '../harness/sessionTest'

/** Export has no catalogue word yet; see `attachmentFooterAction`. */
const EXPORT = 'Export'

/**
 * What an album and a file row are to a screen reader, before anything is fetched, checked
 * against the same expectations the render tests assert, on every platform's own tree: what the
 * desktop draws as buttons, a phone may fold into one element, and what one hides on purpose
 * must be absent from that tree rather than present and unlabelled.
 */
sessionTest({
  title: 'draws an album and a file row as the shared expectations say',
  risk: 'medium',
  clients: { alice: EACH },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')

    await openFirstConversation(alice)
    await alice.waitForVisible(ALBUM_TILE_ID)

    const download = verbName('download')
    for (const [at, name] of SEEDED_ALBUM.entries())
      await expectDescribed(alice, ALBUM_TILE_ID, albumTile({ name, hint: download }), at)
    await expectDescribed(alice, FETCH_HINT_ID, fetchHint({ name: setFetchName(false) }))
    await expectDescribed(
      alice,
      FOOTER_ACTION_ID,
      attachmentFooterAction({ state: 'idle', count: SEEDED_ALBUM.length, exportName: EXPORT }),
    )
    await expectDescribed(
      alice,
      ELEMENT.conversation.attachmentViewList,
      pressArea({ name: 'Show as list' }),
    )

    const receipt = fileRow({
      filename: SEEDED_LIST[0],
      format: SEEDED_RECEIPT.format,
      caption: SEEDED_RECEIPT.size,
      state: 'idle',
      rowVerb: download,
      leadOpens: true,
      leadVerb: download,
      controlName: download,
    })
    // The album above carries the row's id and the caption's, so the receipt is the second of
    // each; it is the first lead, name and control.
    await expectDescribed(alice, ATTACHMENT_ROW_IDS.row, receipt.row, 1)
    await expectDescribed(alice, ATTACHMENT_ROW_IDS.lead, receipt.lead)
    await expectDescribed(alice, ATTACHMENT_ROW_IDS.name, receipt.name)
    await expectDescribed(alice, ATTACHMENT_ROW_IDS.caption, receipt.caption, 1)
    await expectDescribed(alice, ATTACHMENT_ROW_IDS.download, receipt.control)

    await alice.screenshot(`attachment-accessibility-${alice.platform}`)
  },
})

/** The showcase's albums, oldest first: one picture, then two halves. Tiles count across both. */
const LEFT_HALF = 1

const tileHint = (app: ISessionApp, at: number) => async () =>
  (await app.describe(ALBUM_TILE_ID, at))?.hint

/** A tile keeps its own press while nothing is fetching. */
sessionTest({
  title: 'fetches a picture from its tile',
  risk: 'medium',
  clients: { alice: EACH },
  env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')

    await openFirstConversation(alice)
    await alice.waitForVisible(ALBUM_TILE_ID)
    // Off centre, where no cloud is drawn over it.
    await alice.tapAt(ALBUM_TILE_ID, LEFT_HALF)
    await alice.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
    await alice.tap(ELEMENT.conversation.autoDownloadNo)
    await expect.poll(tileHint(alice, LEFT_HALF), { timeout: 15_000 }).toBe(verbName('open'))
  },
})

/**
 * A row holds while its file fetches, busy and with nothing to press, and lets go after: Android
 * keeps a disabled state that is dropped rather than cleared, so the row says so in every state.
 * Four hundred times slower, so the fetch is still running when a slow driver reads the row.
 */
sessionTest({
  title: 'holds a file row while it fetches and lets it go after',
  risk: 'medium',
  clients: { alice: EACH },
  env: { EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN: '400' },
  run: async ({ alice }) => {
    if (!alice) throw new Error('the harness did not open alice')
    const receipt = (state: 'fetching' | 'ready') =>
      fileRow({
        filename: SEEDED_LIST[0],
        format: SEEDED_RECEIPT.format,
        caption: SEEDED_RECEIPT.size,
        state,
        rowVerb: state === 'ready' ? verbName('open') : undefined,
        leadOpens: true,
        leadVerb: state === 'ready' ? verbName('open') : undefined,
        controlName: state === 'ready' ? EXPORT : undefined,
      }).row

    await openFirstConversation(alice)
    await alice.tap(ATTACHMENT_ROW_IDS.download)
    await alice.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
    await alice.tap(ELEMENT.conversation.autoDownloadNo)

    // The caption counts the bytes as they come, so the name is not asserted while they do.
    await expect(async () => {
      await expectDescribed(alice, ATTACHMENT_ROW_IDS.row, receipt('fetching'), 1, {
        anyName: true,
      })
    }).toPass({ timeout: 15_000 })
    await expect(async () => {
      await expectDescribed(alice, ATTACHMENT_ROW_IDS.row, receipt('ready'), 1)
    }).toPass({ timeout: 180_000 })
  },
})
