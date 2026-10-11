import { expect, test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { downloadFromRow, openFirstConversation } from '../harness/attachments'
import { DesktopApp } from '../harness/DesktopApp'
import { SEEDED_ALBUM, SEEDED_LIST } from '../harness/fixtures'
import type { FocusedElement } from '../harness/KeyboardProbe'

/** Far more stops than the seeded conversation has, so a walk that never wraps fails here. */
const MAX_STOPS = 150

/**
 * Every focus stop in the window once round, in Tab order. Chromium resumes Tab from where focus
 * last was rather than from the top, so the walk starts anywhere and ends back at its first stop.
 */
async function tabStops(app: DesktopApp): Promise<FocusedElement[]> {
  const stops: FocusedElement[] = []
  for (let at = 0; at < MAX_STOPS; at++) {
    await app.pressKey('Tab')
    const stop = await app.focused()
    // Focus passes through the page itself on its way round.
    if (stop === null) continue
    if (stops.length > 0 && JSON.stringify(stop) === JSON.stringify(stops[0])) return stops
    stops.push(stop)
  }
  throw new Error(`still tabbing after ${String(MAX_STOPS)} stops`)
}

/** Tabs until `wanted` has focus. */
async function tabTo(
  app: DesktopApp,
  wanted: (stop: FocusedElement) => boolean,
): Promise<FocusedElement> {
  for (let at = 0; at < MAX_STOPS; at++) {
    await app.pressKey('Tab')
    const stop = await app.focused()
    if (stop !== null && wanted(stop)) return stop
  }
  throw new Error('Tab never reached it')
}

/**
 * Launched directly rather than through `sessionTest`, because focus and keys are a keyboard
 * probe's and `ISessionApp` has none.
 */
test('reaches a picture’s thumbnail and its control with Tab, never its row, and opens it with Enter @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  const picture = SEEDED_LIST[0]
  const document = SEEDED_LIST[1]

  try {
    await openFirstConversation(app)
    // Addressable before there is a thumbnail in it, while its press downloads.
    expect(await app.count(ELEMENT.conversation.attachmentLead)).toBeGreaterThan(0)
    await downloadFromRow(app, picture)

    // The row is no button: one would hold the thumbnail's and the control's, which ARIA flattens.
    const tree = await app.ariaSnapshot(ELEMENT.conversation.screen)
    expect(tree.split(`button "${picture}"`), tree).toHaveLength(2)
    expect(tree).not.toContain(`button "${document}"`)

    const stops = await tabStops(app)
    expect(stops.filter((stop) => stop.testID === ELEMENT.conversation.attachment)).toHaveLength(0)
    const lead = stops.findIndex(
      (stop) => stop.testID === ELEMENT.conversation.attachmentLead && stop.name === picture,
    )
    expect(lead, JSON.stringify(stops, null, 2)).toBeGreaterThanOrEqual(0)

    // The walk is a loop, so the stop after the thumbnail may be at its start.
    expect(stops[lead]).toMatchObject({ role: 'button', hint: 'Open' })
    expect(stops[(lead + 1) % stops.length]).toMatchObject({
      testID: ELEMENT.conversation.attachmentExport,
      role: 'button',
      name: 'Export',
    })

    // Only parts that take a press are stops, never a caption.
    expect(
      stops.filter((stop) => stop.testID === ELEMENT.conversation.attachmentState),
    ).toHaveLength(0)

    const focusedLead = await tabTo(
      app,
      (stop) => stop.testID === ELEMENT.conversation.attachmentLead && stop.name === picture,
    )
    // Reached by the keyboard, so the ring is drawn.
    expect(focusedLead.outlineWidth).not.toBe('0px')
    await app.screenshot('a11y-lead-focus-desktop')

    await app.pressKey('Enter')
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
    const tree = await app.ariaSnapshot(ELEMENT.conversation.attachment)
    for (const name of SEEDED_ALBUM) expect(tree).toContain(`button "${name}"`)

    const stops = await tabStops(app)
    const isTile = (stop: FocusedElement) =>
      stop.name !== null && (SEEDED_ALBUM as readonly string[]).includes(stop.name)
    const tiles = stops.filter(isTile)
    expect(tiles.map((tile) => tile.name)).toEqual([...SEEDED_ALBUM])
    for (const tile of tiles)
      expect(tile).toMatchObject({
        testID: ELEMENT.conversation.attachmentTile,
        role: 'button',
        hint: 'Download',
      })

    expect((await tabTo(app, isTile)).outlineWidth).not.toBe('0px')
    await app.screenshot('a11y-album-tile-focus-desktop')
  } finally {
    await app.close()
  }
})

test('reaches a set’s footer with Tab, switches its view with Enter and downloads with Space @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')

  try {
    await openFirstConversation(app)
    await app.waitForVisible(ELEMENT.conversation.attachmentViewList)

    const toList = await tabTo(
      app,
      (stop) => stop.testID === ELEMENT.conversation.attachmentViewList,
    )
    expect(toList).toMatchObject({ role: 'button', name: 'Show as list' })
    expect(toList.outlineWidth).not.toBe('0px')
    await app.screenshot('a11y-footer-focus-desktop')

    await app.pressKey('Enter')
    await app.waitForVisible(ELEMENT.conversation.attachmentViewGallery)
    // The same button, offering the other shape, so focus stays on it.
    expect((await app.focused())?.testID).toBe(ELEMENT.conversation.attachmentViewGallery)

    const action = await tabTo(app, (stop) => stop.testID === ELEMENT.conversation.attachmentAction)
    expect(action.role).toBe('button')
    await app.pressKey(' ')
    await app.waitForVisible(ELEMENT.conversation.autoDownloadPrompt)
  } finally {
    await app.close()
  }
})

test('keeps focus on the control and the tile whose Enter starts a download @desktop @medium-risk', async () => {
  const app = await DesktopApp.launch('alice')
  const tile = SEEDED_ALBUM[0]

  try {
    await openFirstConversation(app)
    // Answers the auto-download prompt, which takes focus on a conversation's first download.
    await downloadFromRow(app, SEEDED_LIST[0])

    // The picture's control, the one Export, then the control of the document below it, whose
    // row has no lead square to stop on.
    await tabTo(app, (stop) => stop.testID === ELEMENT.conversation.attachmentExport)
    await app.pressKey('Tab')
    expect(await app.focused()).toMatchObject({
      testID: ELEMENT.conversation.attachmentDownload,
      name: 'Download',
    })
    await app.pressKey('Enter')
    // Held as a disabled button while it fetches, then the same element offers Export.
    await expect
      .poll(async () => app.focused(), { timeout: 10_000 })
      .toMatchObject({ testID: ELEMENT.conversation.attachmentExport, name: 'Export' })

    await tabTo(
      app,
      (stop) => stop.testID === ELEMENT.conversation.attachmentTile && stop.name === tile,
    )
    await app.pressKey('Enter')
    await expect
      .poll(async () => app.focused(), { timeout: 10_000 })
      .toMatchObject({ testID: ELEMENT.conversation.attachmentTile, name: tile, hint: 'Open' })
  } finally {
    await app.close()
  }
})
