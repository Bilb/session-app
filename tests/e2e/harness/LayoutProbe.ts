import type { ElementId } from '@session/test-ids'

/**
 * Reading which way a client lays itself out.
 *
 * Deliberately not part of `ISessionApp`, for the reason `IPerformanceProbe` gives: the document
 * and its viewport are Chromium's, reached through `page.evaluate`, and a device driver will need
 * its own way to answer the same questions.
 */
export interface ILayoutProbe {
  /** The `dir` attribute on the document element, which is what `applyDirection` writes. */
  documentDirection(): Promise<string>
  /** Which half of the window the element's centre sits in. */
  horizontalHalf(id: ElementId): Promise<'left' | 'right'>
  /**
   * Whether the first element's centre is left of the second's. Of two siblings, this is what
   * says whether the row holding them mirrored, which the window's halves cannot.
   */
  isLeftOf(first: ElementId, second: ElementId): Promise<boolean>
}
