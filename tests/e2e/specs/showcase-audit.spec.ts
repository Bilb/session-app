import { expect, test, type Locator } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { DesktopApp } from '../harness/DesktopApp'
import type { AuditIssue } from '../harness/ISessionApp'
import { describeIssues, issueKey, unknownIssues } from '../harness/knownIssues'
import { MobileApp, type FormFactor, type MobilePlatform } from '../harness/MobileApp'

/** Narrow is near the window's 380 floor, where a bubble is at its tightest; wide is a laptop. */
const WIDTHS = { narrow: 420, wide: 1280 } as const
const HEIGHT = 800

/** Far more steps than the showcase is tall at the narrowest width. */
const MAX_SCROLL_STEPS = 60

/**
 * Scrolls the tallest scrolled box under `screen` by most of its height, `direction` -1 towards its
 * start; false when it was already at that end.
 */
async function scrollStep(screen: Locator, direction: -1 | 1): Promise<boolean> {
  const moved = await screen.evaluate((root, sign) => {
    interface Box {
      scrollTop: number
      scrollHeight: number
      clientHeight: number
      querySelectorAll(selector: string): ArrayLike<Box>
    }
    const boxes = Array.from((root as unknown as Box).querySelectorAll('*')).filter(
      (box) => box.scrollHeight > box.clientHeight + 1,
    )
    const box = boxes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
    if (box === undefined) return false
    const before = box.scrollTop
    box.scrollTop += sign * box.clientHeight * 0.8
    return box.scrollTop !== before
  }, direction)
  // Two frames: one for the windowed list to mount the rows now in view, one for them to draw.
  await screen.page().evaluate(
    () =>
      new Promise<void>((resolve) => {
        const g = globalThis as unknown as { requestAnimationFrame: (callback: () => void) => void }
        g.requestAnimationFrame(() => g.requestAnimationFrame(resolve))
      }),
  )
  return moved
}

/**
 * The showcase conversation at two widths, every bubble the audit reaches, in the default theme:
 * colour is the component catalog's audit, which draws every theme and accent.
 */
test('draws the showcase with nothing serious for the audit @desktop @low-risk', async () => {
  const app = await DesktopApp.launch('alice', {
    env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' },
  })

  try {
    await app.page.emulateMedia({ reducedMotion: 'reduce' })
    await openFirstConversation(app)
    const screen = app.locator(ELEMENT.conversation.screen).first()

    const found = new Map<string, AuditIssue>()
    for (const px of Object.values(WIDTHS)) {
      await app.resize(px, HEIGHT)
      let atStart = false
      for (let step = 0; step < MAX_SCROLL_STEPS && !atStart; step++)
        atStart = !(await scrollStep(screen, -1))
      for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
        for (const issue of await app.audit(ELEMENT.conversation.screen))
          found.set(issueKey(issue), issue)
        if (!(await scrollStep(screen, 1))) break
      }
    }

    const unknown = unknownIssues('desktop', found.values())
    expect(unknown, describeIssues(unknown).join('\n')).toEqual([])
  } finally {
    await app.close()
  }
})

const MOBILE_PLATFORMS: readonly MobilePlatform[] = ['android', 'ios']
const FORMS: readonly FormFactor[] = ['phone', 'tablet']

/**
 * How far apart two audits are, as a share of the view: each reads a whole screen, so under one
 * apart leaves no part of the transcript unread. An iOS audit takes seconds.
 */
const AUDIT_SPAN = 0.6

for (const platform of MOBILE_PLATFORMS) {
  for (const form of FORMS) {
    test(`draws the showcase on a ${form} with nothing serious for the audit @${platform} @low-risk`, async () => {
      const app = await MobileApp.launch(platform, 'alice', {
        form,
        env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' },
      })

      try {
        await openFirstConversation(app)
        const found = new Map<string, AuditIssue>()
        // To the start first: iOS bounces at an end, so where it opened is no answer.
        for (let step = 0; step < MAX_SCROLL_STEPS; step++)
          if (!(await app.scroll(ELEMENT.conversation.screen, -1))) break
        for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
          for (const issue of await app.audit(ELEMENT.conversation.screen))
            found.set(issueKey(issue), issue)
          if (!(await app.scroll(ELEMENT.conversation.screen, 1, AUDIT_SPAN))) break
        }

        const unknown = unknownIssues(platform, found.values())
        expect(unknown, describeIssues(unknown).join('\n')).toEqual([])
      } finally {
        await app.close()
      }
    })
  }
}
