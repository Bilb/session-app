import { type ReactNode, useEffect, useState } from 'react'
import { YStack } from 'tamagui'

import { type CrossfadeLayer, useCrossfadeLayers } from './crossfadeLayers'
import { logical } from './logicalEdges'
import { TRANSFER_RING_SIDE_PX } from './ProgressRing'
import { UpdateGlyph } from './UpdateGlyph'
import type { UpdateIndicatorProps, UpdateStatus } from './UpdateIndicator.types'
import { useUpdateMorph } from './useUpdateMorph'
import { updateLayerKey, UPDATE_FADE_MS, UPDATE_FADE_SCALE } from './updateIndicatorTiming'

export type { UpdateIndicatorProps, UpdateStatus }

/**
 * A layer fading in or out, the web half: a CSS transition, with the starting values held for one
 * frame so that there is something to transition from, as `Reveal` does.
 */
function FadeLayer({
  leaving,
  instant,
  children,
}: {
  leaving: boolean
  instant: boolean
  children: ReactNode
}) {
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
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      pointerEvents="none"
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

/**
 * The app's update, as a glyph in a ring: available, downloading, ready to install, or failed. A
 * change of state cross-fades, the old glyph shrinking out as the new one grows in, so that it
 * reads as one control changing rather than one replaced by another.
 */
export function UpdateIndicator({ status, instant = false, testID }: UpdateIndicatorProps) {
  const morph = useUpdateMorph(status.kind, instant)
  // A morph draws the change itself, so the layers swap under it rather than fading as well.
  const layers = useCrossfadeLayers(
    updateLayerKey(status),
    status,
    UPDATE_FADE_MS,
    instant || morph !== null,
  )
  return (
    <YStack
      width={TRANSFER_RING_SIDE_PX}
      height={TRANSFER_RING_SIDE_PX}
      position="relative"
      {...(testID === undefined ? {} : { testID })}
    >
      {/* Mounted through a morph, hidden, so that the state it ends on is already drawn and does
          not fade in a second time when the morph hands over. */}
      <YStack
        position="absolute"
        top={0}
        bottom={0}
        {...logical({ insetStart: 0, insetEnd: 0 })}
        opacity={morph === null ? 1 : 0}
      >
        {layers.map((layer: CrossfadeLayer<UpdateStatus>) => (
          <FadeLayer key={layer.id} leaving={layer.leaving} instant={instant || morph !== null}>
            <UpdateGlyph status={layer.value} />
          </FadeLayer>
        ))}
      </YStack>
      {morph === null ? null : (
        <YStack position="absolute" top={0} {...logical({ insetStart: 0 })}>
          <UpdateGlyph status={status} morph={morph} />
        </YStack>
      )}
    </YStack>
  )
}
