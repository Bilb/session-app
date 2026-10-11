import type { ElementId } from '@session/test-ids'

/** What a screen reader and a test can ask of the focused element. */
export interface FocusedElement {
  testID: string | null
  role: string | null
  /** The accessible name the element carries, which is what a screen reader says first. */
  name: string | null
  /** What a press does, said after the name: ARIA's description. */
  hint: string | null
  /** The outline it is drawn with, as computed: `0px` where no focus ring shows. */
  outlineWidth: string
}

/**
 * Driving a client from the keyboard and reading what has focus.
 *
 * Deliberately not part of `ISessionApp`, for the reason `IPerformanceProbe` gives: focus and the
 * keyboard are reached through Playwright here, and a device driver will need its own way to
 * answer the same questions, if it has a keyboard at all.
 */
export interface IKeyboardProbe {
  /** One key or chord, in Playwright's naming: `Tab`, `Shift+Tab`, `Enter`. */
  pressKey(key: string): Promise<void>
  /** Null where nothing but the page has focus. */
  focused(): Promise<FocusedElement | null>
  /** The accessibility tree under the first element with this id, as Playwright reads it. */
  ariaSnapshot(id: ElementId): Promise<string>
}
