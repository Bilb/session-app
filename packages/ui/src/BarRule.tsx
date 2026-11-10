import { Separator } from 'tamagui'

/**
 * The line under a top bar on the desktop, where the current app draws one between the bar and
 * what scrolls under it. The phones draw none: see `BarRule.native.tsx`.
 */
export function BarRule() {
  return <Separator borderColor="$bordersColor" />
}
