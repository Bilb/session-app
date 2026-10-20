import { fileURLToPath } from 'node:url'

import { expect, test, type Locator } from '@playwright/test'
import type { ThemeState } from '@session/theme-tokens'
import { ELEMENT, type ElementId } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { assertBaselinesPulled } from '../harness/baselines'
import { DesktopApp } from '../harness/DesktopApp'
import type { AuditIssue, ISessionApp } from '../harness/ISessionApp'
import { MobileApp, type FormFactor, type MobilePlatform } from '../harness/MobileApp'

const THEMES: readonly ThemeState[] = ['classic-dark', 'classic-light', 'ocean-dark', 'ocean-light']

/** The bubble at `row`, or the `at`th element carrying `id` inside it, from 0. */
interface Capture {
  row: number
  id: ElementId | null
  at: number
}

/**
 * A few of the showcase's controls, by their bubble's place in the transcript: together they draw
 * each theme's attachment colours and the known defects.
 */
const CAPTURES = {
  /**
   * Two pictures as halves, their "N attachments" pill and, under the pointer, the download cloud.
   * A light theme's baseline records their dark ink on the dark scrim, which no audit can see. Not
   * the first bubble, which sits on the transcript's edge, where a phone cannot tell it whole.
   */
  pair: { row: 1, id: ELEMENT.conversation.attachment, at: 0 },
  /** Twelve pictures, seven of them behind "+7". */
  album: { row: 5, id: ELEMENT.conversation.attachment, at: 0 },
  /** The album's footer: the list button and the verb, both drawn under the target minimum. */
  footer: { row: 5, id: ELEMENT.conversation.attachmentFooter, at: 0 },
  /** A document's row on a received bubble, its format and caption in the low-contrast ink. */
  fileRow: { row: 15, id: ELEMENT.conversation.attachment, at: 0 },
  /** A whole bubble: its body, a recording's row and the footer, on the received fill. */
  bubble: { row: 16, id: null, at: 0 },
} as const satisfies Record<string, Capture>

type CaptureName = keyof typeof CAPTURES

const CAPTURE_NAMES = Object.keys(CAPTURES) as CaptureName[]

/**
 * Narrow is near the window's 380 floor, where a bubble is at its tightest; wide is a laptop. A
 * bubble draws the same at both, so only the narrow one is captured; both are audited.
 */
const WIDTHS = { narrow: 420, wide: 1280 } as const
const CAPTURED_AT: keyof typeof WIDTHS = 'narrow'
const HEIGHT = 800

/** Far more steps than the showcase is tall at the narrowest width. */
const MAX_SCROLL_STEPS = 60

/** So nothing the page reads from the clock moves a capture. */
const FIXED_TIME = new Date('2026-01-15T12:00:00Z')

/**
 * Findings that are the app's and known, keyed `rule target`, each with why it stands.
 *
 * An entry here is a bug with a name, not a pass: it keeps the audit failing on anything new.
 */
const KNOWN_ISSUES: Partial<Record<ISessionApp['platform'], Readonly<Record<string, string>>>> = {
  desktop: {
    'color-contrast message-attachment-state':
      'textSecondary at caption size on a received bubble is 3.5 to 4.1:1 in every theme, under AA',
    'color-contrast message-attachment': 'the format line under a lead square: the same ink',
    'color-contrast message-attachment-show-all': "the roll's Show all count: the same ink",
  },
  android: {
    'target-size conversation-back':
      'drawn at 32dp; its hitSlop reaches MIN_HIT_TARGET, 40, which is under 48 and not in the bounds',
    'target-size message-attachment-view-list':
      "drawn at 32dp; its hitSlop fills the footer's 48 row, which the tree does not show",
    'target-size message-attachment-action':
      'the same: attachment-footer.spec.ts taps the row edges',
    'target-size message-attachment-show-all': 'a PressArea 32dp tall, with no hitSlop at all',
  },
  ios: {
    'XCUIAccessibilityAuditTypeSufficientElementDescription message-attachment-tile':
      "a tile is named by its filename, which Apple's audit reads as no human-readable label",
    'target-size conversation-back':
      'drawn at 32pt; its hitSlop reaches MIN_HIT_TARGET, 40, which is under 44 and not in the bounds',
    'target-size message-attachment-view-list':
      "drawn at 32pt; its hitSlop fills the footer's 48 row, which the tree does not show",
    'target-size message-attachment-action':
      'the same: attachment-footer.spec.ts taps the row edges',
    'target-size message-attachment-show-all': 'a PressArea 32pt tall, with no hitSlop at all',
  },
}

const key = (issue: AuditIssue) => `${issue.rule} ${issue.target}`

const unknownIssues = (platform: ISessionApp['platform'], found: Iterable<AuditIssue>) =>
  [...found].filter((issue) => !(key(issue) in (KNOWN_ISSUES[platform] ?? {})))

/** What a theme's run found wrong, read in one place once every cell has been visited. */
function summary(cell: string, mismatched: string[], unknown: AuditIssue[]): string {
  return [
    `${cell}: ${String(mismatched.length)} capture(s) differ from their baseline, ${String(unknown.length)} unknown audit finding(s)`,
    ...mismatched.map((name) => `  capture ${name}`),
    ...unknown.map((issue) => `  ${key(issue)}: ${issue.message}`),
  ].join('\n')
}

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

test.beforeAll(() => {
  assertBaselinesPulled(fileURLToPath(new URL('./themes.spec.ts-snapshots', import.meta.url)))
})

/**
 * The showcase conversation in one theme, at two widths: every bubble the audit reaches, and a
 * capture of each control above against a baseline someone has looked at. One launch visits
 * every cell, and the run fails once at the end with what every cell found.
 *
 * The theme comes from the launch, not from the settings, so a cell never depends on a walk
 * through the appearance page having worked. UTC and a fixed clock, so no time moves a capture.
 */
for (const theme of THEMES) {
  test(`draws the showcase in ${theme}, with nothing serious for the audit @desktop @low-risk`, async () => {
    const app = await DesktopApp.launch('alice', {
      env: {
        EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase',
        EXPO_PUBLIC_SESSION_THEME: theme,
        TZ: 'UTC',
      },
    })

    try {
      await app.page.clock.setFixedTime(FIXED_TIME)
      await app.page.emulateMedia({ reducedMotion: 'reduce' })
      await openFirstConversation(app)
      const screen = app.locator(ELEMENT.conversation.screen).first()

      const found = new Map<string, AuditIssue>()
      const mismatched: string[] = []
      for (const [width, px] of Object.entries(WIDTHS)) {
        await app.resize(px, HEIGHT)
        let atStart = false
        for (let step = 0; step < MAX_SCROLL_STEPS && !atStart; step++)
          atStart = !(await scrollStep(screen, -1))
        const left = new Set(width === CAPTURED_AT ? CAPTURE_NAMES : [])
        for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
          for (const issue of await app.audit(ELEMENT.conversation.screen))
            found.set(key(issue), issue)
          for (const capture of [...left]) {
            const { row, id, at } = CAPTURES[capture]
            const bubble = app.locator(ELEMENT.conversation.messageRow(row)).first()
            if ((await bubble.count()) === 0) continue
            left.delete(capture)
            const target = id === null ? bubble : bubble.getByTestId(id).nth(at)
            const name = `${theme}-${capture}.png`
            const failures = test.info().errors.length
            // The desktop draws the cloud only under the pointer.
            if (capture === 'pair')
              await bubble
                .getByTestId(ELEMENT.conversation.attachmentTile)
                .first()
                .hover({ force: true })
            await expect.soft(target).toHaveScreenshot(name, {
              animations: 'disabled',
              caret: 'hide',
              scale: 'css',
            })
            await app.page.mouse.move(0, 0)
            if (test.info().errors.length > failures) mismatched.push(name)
          }
          if (!(await scrollStep(screen, 1))) break
        }
        for (const capture of left) mismatched.push(`${theme}-${capture}: never drawn`)
      }

      const unknown = unknownIssues('desktop', found.values())
      expect([...mismatched, ...unknown], summary(theme, mismatched, unknown)).toEqual([])
    } finally {
      await app.close()
    }
  })
}

const MOBILE_PLATFORMS: readonly MobilePlatform[] = ['android', 'ios']
const FORMS: readonly FormFactor[] = ['phone', 'tablet']

/**
 * How far each step down the transcript moves, as a share of the view: short enough that every
 * captured bubble is whole on some step, where a longer swipe leaves the tallest cut on each.
 */
const VISIT_SPAN = 0.3

/**
 * How far apart two audits are, as a share of the view: each reads a whole screen, so under one
 * apart leaves no part of the transcript unread. An iOS audit takes seconds.
 */
const AUDIT_SPAN = 0.6

/** Font rendering and image decoding differ by a few pixels between runs of one device. */
const MAX_DIFF_PIXEL_RATIO = 0.002

/**
 * The same on a phone and a tablet of each mobile platform, against that platform's baselines. No
 * capture draws the time or holds a caret, and the fake keeps its own fixed clock, so neither needs
 * an override; the launch turns motion off. A capture is the element alone, so it leaves out the
 * status bar, whose icons Android draws light on a light theme's header. Themes are the outer loop
 * because each is its own bundle on a device, and a change of bundle restarts Metro.
 */
for (const platform of MOBILE_PLATFORMS) {
  for (const theme of THEMES) {
    for (const form of FORMS) {
      test(`draws the showcase in ${theme} on a ${form}, with nothing serious for the audit @${platform} @low-risk`, async () => {
        const app = await MobileApp.launch(platform, 'alice', {
          form,
          env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase', EXPO_PUBLIC_SESSION_THEME: theme },
        })

        try {
          await openFirstConversation(app)
          const found = new Map<string, AuditIssue>()
          const mismatched: string[] = []
          const left = new Set(CAPTURE_NAMES)
          const audit = async () => {
            for (const issue of await app.audit(ELEMENT.conversation.screen))
              found.set(key(issue), issue)
          }
          // Before the audit, which reads the page source a capture can share.
          const captureLeft = async () => {
            const shown = await app.captureShown(
              [...left].map((capture) => {
                const { row, id, at } = CAPTURES[capture]
                return { name: capture, scope: ELEMENT.conversation.messageRow(row), id, at }
              }),
            )
            for (const [capture, png] of shown) {
              left.delete(capture as CaptureName)
              const name = `${theme}-${form}-${capture}.png`
              const failures = test.info().errors.length
              expect.soft(png).toMatchSnapshot(name, { maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO })
              if (test.info().errors.length > failures) mismatched.push(name)
            }
          }
          // To the start first: iOS bounces at an end, so where it opened is no answer.
          for (let step = 0; step < MAX_SCROLL_STEPS; step++)
            if (!(await app.scroll(ELEMENT.conversation.screen, -1))) break
          // Short steps while a capture is left, and an audit every AUDIT_SPAN of the way down.
          let sinceAudit = AUDIT_SPAN
          for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
            if (left.size > 0) await captureLeft()
            if (sinceAudit >= AUDIT_SPAN) {
              await audit()
              sinceAudit = 0
            }
            const span = left.size > 0 ? VISIT_SPAN : AUDIT_SPAN - sinceAudit
            if (!(await app.scroll(ELEMENT.conversation.screen, 1, span))) break
            sinceAudit += span
          }
          if (sinceAudit > 0) await audit()
          for (const capture of left) mismatched.push(`${theme}-${form}-${capture}: never drawn`)

          const unknown = unknownIssues(platform, found.values())
          expect(
            [...mismatched, ...unknown],
            summary(`${theme} on a ${platform} ${form}`, mismatched, unknown),
          ).toEqual([])
        } finally {
          await app.close()
        }
      })
    }
  }
}
