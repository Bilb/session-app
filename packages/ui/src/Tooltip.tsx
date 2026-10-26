import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { YStack } from 'tamagui'

import { SPACE_SCALE } from './scales'
import { shadowWithAlpha } from './shadowColour'
import { Text } from './Text'
import type { TooltipProps } from './Tooltip.types'
import { TOOLTIP_ARROW_REACH_PX, TOOLTIP_BUBBLE_RADIUS, TooltipArrow } from './TooltipArrow'
import { tooltipPosition } from './tooltipPosition'
import { useTokenColor } from './useTokenColor'

export type { TooltipProps }

/**
 * How long a pointer rests on the control before the tooltip shows: long enough that sweeping
 * across the rail does not flash every one of them.
 */
const HOVER_DELAY_MS = 150

/** The arrow's tip clear of the control, so the bubble does not read as part of it. */
const GAP_PX = SPACE_SCALE.xs + TOOLTIP_ARROW_REACH_PX

/**
 * The shadow's darkest. Dark themes draw shadows in opaque black, which round a bubble this small
 * reads as a heavy smudge rather than a lift.
 */
const SHADOW_ALPHA_MAX = 0.51

/** Past this a label wraps rather than running across the window. */
const MAX_WIDTH_PX = 240

/** Above the pane beside the control, which comes later in the page and would cover it. */
const LAYER = 10

/**
 * Whether focus arrived by keyboard. A click focuses the control too, and a tooltip that opened
 * on every click would sit over whatever the click opened.
 */
function focusVisible(event: FocusEvent): boolean {
  const target = event.target as Element | null
  try {
    return target?.matches(':focus-visible') ?? false
  } catch {
    // A browser without the selector: showing on every focus beats never showing on keyboard.
    return true
  }
}

/**
 * The web half: a bubble beside a control, on a resting pointer or on keyboard focus.
 *
 * WCAG 1.4.13's three rules for content on hover or focus: it can be **dismissed** without moving
 * the pointer or focus (Escape, heard on the document, since focus may be anywhere while a resting
 * pointer holds it open), it is **hoverable** (the bubble and the gap before it are inside the
 * wrapper, so moving onto it is not leaving), and it **persists** until one of those or a blur
 * ends it. A press hides it, since the control has now done what the tooltip described.
 *
 * Laid out in place rather than through a portal, so it needs no measuring and mirrors with the
 * page; the cost is that an ancestor clipping its overflow would clip the bubble too.
 */
export function Tooltip({
  label,
  placement = 'end',
  held = false,
  children,
  testID,
}: TooltipProps) {
  const [hovered, setOpen] = useState(false)
  const open = held || hovered
  const [bubble, setBubble] = useState<{ width: number; height: number } | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const shadow = useTokenColor('$shadow')
  useEffect(() => () => clearTimeout(pending.current), [])

  const show = (): void => {
    clearTimeout(pending.current)
    setOpen(true)
  }
  const hide = (): void => {
    clearTimeout(pending.current)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <YStack
      position="relative"
      {...(open ? { zIndex: LAYER } : {})}
      onMouseEnter={() => {
        clearTimeout(pending.current)
        pending.current = setTimeout(show, HOVER_DELAY_MS)
      }}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(event: FocusEvent) => {
        if (focusVisible(event)) show()
      }}
      onBlur={hide}
    >
      {children}
      {open ? (
        <YStack
          aria-hidden
          zIndex={LAYER}
          justifyContent="center"
          alignItems="center"
          style={{ ...tooltipPosition(placement, GAP_PX), width: 'max-content' }}
        >
          <YStack
            position="relative"
            backgroundColor="$messageBubbleIncomingBg"
            borderRadius={TOOLTIP_BUBBLE_RADIUS}
            boxShadow={`0px 0px 13px 0px ${shadowWithAlpha(shadow, (a) => Math.min(a, SHADOW_ALPHA_MAX))}`}
            maxWidth={MAX_WIDTH_PX}
            testID={testID}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              setBubble({ width, height })
            }}
          >
            <TooltipArrow placement={placement} bubble={bubble} />
            {/* Positioned, so it draws over the arrow, which is too. */}
            <YStack position="relative" paddingVertical="$2xs" paddingHorizontal="$md">
              <Text size="$body" color="$messageBubbleIncomingText" userSelect="none">
                {label}
              </Text>
            </YStack>
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
