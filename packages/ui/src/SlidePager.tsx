import type { SlidePagerProps } from './SlidePager.types'

export type { SlidePagerProps }

/**
 * The page that is showing, and nothing else.
 *
 * A pager is a touch idiom: the desktop client's tabbed screens cut between panes. Here so that
 * shared code can lay pages out without asking which platform it is on.
 */
export function SlidePager({ index, children }: SlidePagerProps) {
  return <>{children[index] ?? null}</>
}
