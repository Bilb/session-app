import type { ReactNode } from 'react'

export interface SwipeToReplyProps {
  /** Letting go past the threshold. */
  onReply: () => void
  /** Off for a message deleted or still sending, which cannot be answered yet. */
  enabled?: boolean | undefined
  children: ReactNode
}
