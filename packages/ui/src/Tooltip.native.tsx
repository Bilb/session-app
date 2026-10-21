import type { TooltipProps } from './Tooltip.types'

export type { TooltipProps }

/**
 * Nothing on touch: the control alone.
 *
 * Neither phone platform shows a tooltip on its own controls, and neither legacy mobile client has
 * one. A long press would be the only way to ask, and it is a gesture nobody discovers, which on a
 * control that has an accessibility label buys nothing: VoiceOver and TalkBack already read the
 * same words. A pointer on an iPad is the one case it misses, as UIKit's own buttons do.
 */
export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>
}
