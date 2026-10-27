import { useEffect, useState } from 'react'
import { YStack } from 'tamagui'

import type { UpdateFadeLayerProps } from './UpdateFadeLayer.types'
import { UPDATE_FADE_MS, UPDATE_FADE_SCALE } from './updateIndicatorTiming'

/**
 * A layer fading in or out, the web half: a CSS transition, with the starting values held for one
 * frame so that there is something to transition from, as `Reveal` does.
 */
export function UpdateFadeLayer({ leaving, instant, children }: UpdateFadeLayerProps) {
  const [entered, setEntered] = useState(instant)
  useEffect(() => {
    if (entered) return
    const frame = setTimeout(() => {
      setEntered(true)
    }, 16)
    return () => {
      clearTimeout(frame)
    }
  }, [entered])
  // A departing layer is a new element, mounted as the old one goes, so it starts drawn and fades
  // out from there; an arriving one starts hidden and fades in.
  const shown = leaving ? !entered : entered
  return (
    <YStack
      opacity={shown ? 1 : 0}
      style={{
        transform: `scale(${String(shown ? 1 : UPDATE_FADE_SCALE)})`,
        ...(instant
          ? {}
          : {
              transition: `opacity ${String(UPDATE_FADE_MS)}ms ease-out, transform ${String(UPDATE_FADE_MS)}ms ease-out`,
            }),
      }}
    >
      {children}
    </YStack>
  )
}
