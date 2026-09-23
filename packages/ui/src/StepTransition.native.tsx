import { useRef, useState, type ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { ScreenStack, ScreenStackItem } from 'react-native-screens'

import { nextStack } from './stepStack'
import type { StepTransitionProps } from './StepTransition.types'

export type { StepTransitionProps }

/**
 * The push and pop between onboarding steps, as the platform's own navigation stack draws them.
 *
 * **The flow's reducer is still what decides the step**; this mirrors it into a native stack, so a
 * move forward is the platform's push and a move back its pop -- the same curve, the same timing,
 * interruptible, and on iOS with the interactive back swipe. A swipe that completes asks the flow
 * to go back through `onBack`, exactly as the step's own back control does, and the stack then
 * follows the flow like any other move.
 *
 * Every step on the stack stays mounted beneath the one showing, as a native stack keeps them; the
 * one on top always renders `children`, and those below render what they last showed.
 *
 * The phones only: the wide designs cross-fade inside their chrome and never reach this.
 */
export function StepTransition({
  stepKey,
  direction,
  instant = false,
  onBack,
  children,
}: StepTransitionProps) {
  const [stack, setStack] = useState<string[]>([stepKey])
  const shown = useRef(new Map<string, ReactNode>())
  shown.current.set(stepKey, children)

  // Follows the flow as it renders rather than in an effect, so the frame that has the new step
  // is the frame that pushes it.
  if (stack.at(-1) !== stepKey) setStack(nextStack(stack, stepKey, direction))

  return (
    <ScreenStack style={styles.fill}>
      {stack.map((key) => {
        const top = key === stack.at(-1)
        return (
          <ScreenStackItem
            key={key}
            screenId={key}
            headerConfig={{ hidden: true }}
            stackAnimation={instant ? 'none' : 'default'}
            // Only the top can be swiped away, and only where the flow has somewhere to go.
            gestureEnabled={top && onBack !== undefined}
            onDismissed={() => {
              // The platform has already taken the screen off; the flow catches up, and the
              // stack follows it on the next render.
              onBack?.()
            }}
            contentStyle={styles.fill}
          >
            {top ? children : shown.current.get(key)}
          </ScreenStackItem>
        )
      })}
    </ScreenStack>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
