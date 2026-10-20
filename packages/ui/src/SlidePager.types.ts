import type { ReactNode } from 'react'

export interface SlidePagerProps {
  /** Which page is showing. Changing it slides. */
  index: number
  /** Cut rather than slide. See the `disableAnimations` flag. */
  instant?: boolean
  /**
   * Hide the pages that are not showing, for a pager that is narrower than the window.
   *
   * A page at rest sits one pager-width to the side. Where the pager is the whole window that is
   * off screen already; where it is a column inside one, it is beside the column and in plain
   * sight, so it has to be clipped.
   *
   * **Off by default, because clipping is not free**: it takes both axes, so a page that draws
   * deliberately past its own edge -- a camera preview reaching under the home indicator -- loses
   * that too. Whoever lays the pager out knows both facts and so decides.
   */
  clip?: boolean
  /**
   * Be as tall as the page showing, rather than as tall as whatever lays the pager out.
   *
   * For a pager inside something that scrolls. The pages are positioned over each other, so a
   * pager gives its container no height of its own -- and in a scrolling column that left the
   * page clipped at the column's floor with nothing to scroll. With this the page showing is laid
   * out in place and sets the height; the others still sit over it to slide. A page that only
   * fills, like a camera preview, then needs a height of its own.
   */
  fitsPage?: boolean
  /** One per page, in order. */
  children: ReactNode[]
}
