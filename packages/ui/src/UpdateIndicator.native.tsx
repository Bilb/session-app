import { type ReactNode, useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { YStack } from 'tamagui'

import { type CrossfadeLayer, useCrossfadeLayers } from './crossfadeLayers'
import { logical } from './logicalEdges'
import { TRANSFER_RING_SIDE_PX } from './ProgressRing'
import { UpdateGlyph } from './UpdateGlyph'
import type { UpdateIndicatorProps, UpdateStatus } from './UpdateIndicator.types'
import { useUpdateMorph } from './useUpdateMorph'
import { updateLayerKey, UPDATE_FADE_MS, UPDATE_FADE_SCALE } from './updateIndicatorTiming'

export type { UpdateIndicatorProps, UpdateStatus }

/** A layer fading in or out, the native half. */
function FadeLayer({
  leaving,
  instant,
  children,
}: {
  leaving: boolean
  instant: boolean
  children: ReactNode
}) {
  const shown = useRef(new Animated.Value(instant ? 1 : 0)).current
  useEffect(() => {
    const target = leaving ? 0 : 1
    if (instant) {
      shown.setValue(target)
      return
    }
    const run = Animated.timing(shown, {
      toValue: target,
      duration: UPDATE_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    run.start()
    return () => {
      run.stop()
    }
  }, [leaving, instant, shown])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: shown,
        transform: [
          { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [UPDATE_FADE_SCALE, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

/** See UpdateIndicator.tsx. */
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
