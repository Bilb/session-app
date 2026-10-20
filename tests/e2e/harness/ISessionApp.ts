import type { ElementId } from '@session/test-ids'

/**
 * What a test may ask of a running client, whichever one it is.
 *
 * Every member here must use platform-neutral signatures only - primitives, enums and plain
 * data. No Playwright Locator and no Appium element type may appear in this file. Anything
 * one platform cannot do today belongs in a narrower interface until every platform can
 * satisfy it, at which point it is promoted here.
 *
 * That rule is what keeps a flow spec honest: if it can only be written against one
 * platform's vocabulary, it is not a shared flow.
 */
/**
 * One element as assistive technology reads it, in terms every platform's tree can answer.
 *
 * Desktop reads ARIA, Android UiAutomator2's node, iOS XCUITest's element: each driver maps its
 * own vocabulary onto this, so one expectation is checked against all three.
 */
export interface AccessibleNode {
  role: 'button' | 'image' | 'text' | 'link' | 'textbox' | 'progressbar' | 'none'
  /** What a screen reader says first: ARIA's name, Android's content-desc, iOS's label. */
  name: string | null
  /** What a press does, said after the name: ARIA's description, iOS's hint. */
  hint: string | null
  disabled: boolean
  busy: boolean
  /** Whether it is a stop for the keyboard or a switch. */
  focusable: boolean
  /** In the platform's own unit: CSS px, dp or pt. */
  bounds: { width: number; height: number }
}

/** One finding of a platform's accessibility checker. */
export interface AuditIssue {
  /** The checker's own rule name: axe's `color-contrast`, an Appium audit's type. */
  rule: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  /** The nearest test id at or above the offender, otherwise the checker's own selector. */
  target: string
  message: string
}

export interface ISessionApp {
  readonly platform: 'desktop' | 'android' | 'ios'
  /** Which account this client is signed into, for failure messages and screenshots. */
  readonly identity: string

  waitForVisible(id: ElementId, options?: { timeoutMs?: number }): Promise<void>
  isVisible(id: ElementId): Promise<boolean>
  /** Whether the control says it is disabled, which is what a reader announces. */
  isDisabled(id: ElementId): Promise<boolean>
  tap(id: ElementId): Promise<void>
  /** Taps the `at`th carrying this id, from 0 in the order they appear: one row of a list. */
  tapAt(id: ElementId, at: number): Promise<void>
  type(id: ElementId, text: string): Promise<void>
  readText(id: ElementId): Promise<string>
  /** Every occurrence, in the order they appear - a transcript, a conversation list. */
  readAllText(id: ElementId): Promise<string[]>
  /** How many carry this id. A control that must appear on some rows and not others. */
  count(id: ElementId): Promise<number>
  /**
   * Whether the picture at `id` actually has its bytes, not merely an element on screen.
   *
   * Its own member because the two are genuinely different here: an attachment draws its box
   * from the dimensions the sender supplied, so a picture whose bytes never arrived is present,
   * laid out and the right shape - `isVisible` cannot tell it from one that loaded.
   */
  imageLoaded(id: ElementId, options?: { timeoutMs?: number }): Promise<boolean>
  /**
   * The `at`th element carrying this id as assistive technology reads it, from 0; null when
   * nothing with the id is in the accessibility tree, hidden on purpose included.
   */
  describe(id: ElementId, at?: number): Promise<AccessibleNode | null>
  /**
   * What the platform's own checker finds serious or critical on screen, or under `scope`.
   *
   * Only those two impacts, so an empty answer is the pass a spec asserts: lesser findings are
   * the checker's opinion rather than a barrier to anyone.
   */
  audit(scope?: ElementId): Promise<AuditIssue[]>
  screenshot(name: string): Promise<void>
  close(): Promise<void>
}
