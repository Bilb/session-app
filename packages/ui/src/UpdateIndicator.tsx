import { YStack } from 'tamagui'

import { type CrossfadeLayer, useCrossfadeLayers } from './crossfadeLayers'
import { logical } from './logicalEdges'
import { TRANSFER_RING_SIDE_PX } from './ProgressRing'
import { UpdateFadeLayer } from './UpdateFadeLayer'
import { UpdateGlyph } from './UpdateGlyph'
import type { UpdateIndicatorProps, UpdateStatus } from './UpdateIndicator.types'
import { useUpdateMorph } from './useUpdateMorph'
import { updateLayerKey, UPDATE_FADE_MS } from './updateIndicatorTiming'

export type { UpdateIndicatorProps, UpdateStatus }

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
          <YStack
            key={layer.id}
            position="absolute"
            top={0}
            bottom={0}
            {...logical({ insetStart: 0, insetEnd: 0 })}
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
          >
            <UpdateFadeLayer leaving={layer.leaving} instant={instant || morph !== null}>
              <UpdateGlyph status={layer.value} />
            </UpdateFadeLayer>
          </YStack>
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
