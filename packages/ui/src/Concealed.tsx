import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

/**
 * Its children invisible but still laid out, while `when`, so swapping something in over them moves
 * nothing around them. Nothing wraps them otherwise, so shown they are exactly what they were.
 *
 * Android drops a fully transparent view from the accessibility tree: what a screen reader should
 * still hear while they are hidden has to be named on the control itself, as Button does.
 */
export function Concealed({ when, children }: { when: boolean; children: ReactNode }) {
  if (children === undefined || children === null) return null
  return when ? <YStack opacity={0}>{children}</YStack> : <>{children}</>
}
