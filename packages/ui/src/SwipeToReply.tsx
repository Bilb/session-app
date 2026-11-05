import type { SwipeToReplyProps } from './SwipeToReply.types'

export type { SwipeToReplyProps }

/** The desktop has no swipe: a reply starts from the message menu or a double-click. */
export function SwipeToReply({ children }: SwipeToReplyProps) {
  return <>{children}</>
}
