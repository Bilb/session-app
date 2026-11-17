import { expect, test } from '@playwright/test'
import {
  albumTile,
  attachmentFooterAction,
  fileRow,
  pressArea,
  verbName,
  type FileRowState,
} from '@session/expectations'
import { PENDING_COPY } from '@session/localization'
import { ELEMENT } from '@session/test-ids'

import { downloadFromRow, openFirstConversation } from '../harness/attachments'
import { DesktopApp } from '../harness/DesktopApp'
import { onDesktop } from '../harness/expected'
import { SEEDED_ALBUM, SEEDED_LIST } from '../harness/fixtures'
import { focusMessageHolding, tabStops, tabTo, type Stop } from '../harness/keyboard'

/** Export has no catalogue word yet; see `attachmentFooterAction`. */
const EXPORT = verbName('export')

/** A list row's parts, on the desktop, in the transfer state given. */
const rowParts = (filename: string, state: FileRowState, controlName: string) => {
  const parts = fileRow({
    filename,
    format: '',
    caption: '',
    state,
    leadOpens: true,
    leadVerb: state === 'ready' ? verbName('open') : undefined,
    controlName,
  })
  return { lead: onDesktop(parts.lead), control: onDesktop(parts.control) }
}

const isLead = (name: string) => (stop: Stop) =>
  stop.testID === ELEMENT.conversation.attachmentLead && stop.node?.name === name

/**
 * Launched directly rather than through `sessionTest`, because focus and keys are reached through
 * Playwright and `ISessionApp` has neither.
 */
test('reaches a picture’s thumbnail and its control with Tab, never its row, and opens it with Enter @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  const picture = SEEDED_LIST[0]
  const document = SEEDED_LIST[1]
  const focused = app.page.locator(':focus')

  try {
    await openFirstConversation(app)
    // Addressable before there is a thumbnail in it, while its press downloads.
    expect(await app.count(ELEMENT.conversation.attachmentLead)).toBeGreaterThan(0)
    await downloadFromRow(app, picture)

    // The row is no button: one would hold the thumbnail's and the control's, which ARIA flattens.
    const screen = app.locator(ELEMENT.conversation.screen).first()
    await expect(screen.getByRole('button', { name: picture, exact: true })).toHaveCount(1)
    await expect(screen.getByRole('button', { name: document, exact: true })).toHaveCount(0)

    const stops = await tabStops(app)
    expect(stops.filter((stop) => stop.testID === ELEMENT.conversation.attachment)).toHaveLength(0)
    const lead = stops.findIndex(isLead(picture))
    expect(lead, JSON.stringify(stops, null, 2)).toBeGreaterThanOrEqual(0)

    // The walk is a loop, so the stop after the thumbnail may be at its start.
    const expected = rowParts(picture, 'ready', EXPORT)
    expect(stops[lead]?.node).toMatchObject(expected.lead)
    expect(stops[(lead + 1) % stops.length]).toMatchObject({
      testID: ELEMENT.conversation.attachmentExport,
      node: expected.control,
    })

    // Only parts that take a press are stops, never a caption.
    expect(
      stops.filter((stop) => stop.testID === ELEMENT.conversation.attachmentState),
    ).toHaveLength(0)

    await tabTo(app, isLead(picture))
    // Reached by the keyboard, so the ring is drawn.
    await expect(focused).not.toHaveCSS('outline-width', '0px')
    await app.screenshot('a11y-lead-focus-desktop')

    await app.page.keyboard.press('Enter')
    await app.waitForVisible(ELEMENT.conversation.mediaViewer)
    await app.tap(ELEMENT.conversation.mediaViewerClose)
    await expect
      .poll(async () => app.isVisible(ELEMENT.conversation.mediaViewer), { timeout: 5_000 })
      .toBe(false)
  } finally {
    await app.close()
  }
})

test('names each album tile and says what a press on it does @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')

  try {
    await openFirstConversation(app)
    // The album is the conversation's first attachment, and nothing in it is here yet.
    await app.waitForVisible(ELEMENT.conversation.attachment)
    await expect(app.locator(ELEMENT.conversation.attachment).first()).toMatchAriaSnapshot(`
      - button "${SEEDED_ALBUM[0]}"
      - button "${SEEDED_ALBUM[1]}"
    `)

    await focusMessageHolding(app, ELEMENT.conversation.attachmentTile)
    const stops = await tabStops(app)
    const isTile = (stop: Stop) =>
      stop.testID === ELEMENT.conversation.attachmentTile &&
      (SEEDED_ALBUM as readonly (string | null | undefined)[]).includes(stop.node?.name)
    const tiles = stops.filter(isTile)
    expect(tiles.map((tile) => tile.node?.name)).toEqual([...SEEDED_ALBUM])
    for (const [at, tile] of tiles.entries())
      expect(tile.node).toMatchObject(
        onDesktop(albumTile({ name: SEEDED_ALBUM[at] ?? '', hint: verbName('download') })),
      )

    await tabTo(app, isTile)
    await expect(app.page.locator(':focus')).not.toHaveCSS('outline-width', '0px')
    await app.screenshot('a11y-album-tile-focus-desktop')
  } finally {
    await app.close()
  }
})

test('reaches a set’s footer with Tab, switches its view with Enter and downloads with Space @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  const focused = app.page.locator(':focus')

  try {
    await openFirstConversation(app)
    await app.waitForVisible(ELEMENT.conversation.attachmentViewList)

    await focusMessageHolding(app, ELEMENT.conversation.attachmentViewList)
    const toList = await tabTo(
      app,
      (stop) => stop.testID === ELEMENT.conversation.attachmentViewList,
    )
    expect(toList.node).toMatchObject(
      onDesktop(pressArea({ name: PENDING_COPY.attachmentViewList })),
    )
    await expect(focused).not.toHaveCSS('outline-width', '0px')
    await app.screenshot('a11y-footer-focus-desktop')

    await app.page.keyboard.press('Enter')
    await app.waitForVisible(ELEMENT.conversation.attachmentViewGallery)
    // The same button, offering the other shape, so focus stays on it.
    await expect(focused).toHaveAttribute('data-testid', ELEMENT.conversation.attachmentViewGallery)

    const action = await tabTo(app, (stop) => stop.testID === ELEMENT.conversation.attachmentAction)
    expect(action.node).toMatchObject(
      onDesktop(attachmentFooterAction({ state: 'idle', count: SEEDED_ALBUM.length })),
    )
    await app.page.keyboard.press(' ')
    await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  } finally {
    await app.close()
  }
})

test('keeps focus on the control and the tile whose Enter starts a download @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  const tile = SEEDED_ALBUM[0]
  const focused = app.page.locator(':focus')

  try {
    await openFirstConversation(app)
    // Answers the auto-download prompt, which takes focus on a conversation's first download.
    await downloadFromRow(app, SEEDED_LIST[0])

    // The picture's control, the one Export, then the control of the document below it, whose
    // row has no lead square to stop on.
    await focusMessageHolding(app, ELEMENT.conversation.attachmentExport)
    await tabTo(app, (stop) => stop.testID === ELEMENT.conversation.attachmentExport)
    await app.page.keyboard.press('Tab')
    await expect(focused).toHaveAttribute('data-testid', ELEMENT.conversation.attachmentDownload)
    await expect(focused).toHaveAccessibleName(verbName('download'))
    await app.page.keyboard.press('Enter')
    // Held as a disabled button while it fetches, then the same element offers Export.
    await expect(focused).toHaveAttribute('data-testid', ELEMENT.conversation.attachmentExport, {
      timeout: 10_000,
    })
    await expect(focused).toHaveAccessibleName(EXPORT)

    await focusMessageHolding(app, ELEMENT.conversation.attachmentTile)
    await tabTo(
      app,
      (stop) => stop.testID === ELEMENT.conversation.attachmentTile && stop.node?.name === tile,
    )
    await app.page.keyboard.press('Enter')
    await expect(focused).toHaveAccessibleDescription(verbName('open'), { timeout: 10_000 })
    await expect(focused).toHaveAttribute('data-testid', ELEMENT.conversation.attachmentTile)
    await expect(focused).toHaveAccessibleName(tile)
  } finally {
    await app.close()
  }
})
