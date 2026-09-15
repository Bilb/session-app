import { useState } from 'react'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'

import { YStack } from 'tamagui'

/**
 * How far the target sits in from the nearest edge. iOS's `largeSpacing`.
 *
 * Measured against the *shorter* side, which is what keeps the target square whatever shape the
 * pane is: on a phone that is the width, and the dimming above and below it grows instead.
 */
const INSET = 24

/** The target's corner radius. iOS rounds its cutout by 16; Android rounds its patch by 26. */
const CORNER = 16

/** How dark the surroundings go. iOS's 0.32 -- enough to lead the eye without hiding the frame. */
const DIM = 0.32

/**
 * The dimmed surround and clear square a scanner puts over its camera.
 *
 * **iOS's treatment, not Android's, and the two are opposites.** iOS lays 32% black over the whole
 * preview and punches a rounded square out of it; Android leaves the surroundings alone and washes
 * the target with 20% white instead. Darkening everything else is the one that says where to point
 * the camera rather than merely marking a spot on it, and it is the one asked for.
 *
 * Drawn rather than composed out of four boxes around a hole, because the hole has rounded corners:
 * a mask is the only way to take a rounded shape *out* of a filled one.
 */
export function ScannerFrame() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { width, height } = size
  const side = Math.max(0, Math.min(width, height) - INSET * 2)

  return (
    <YStack
      fullscreen
      pointerEvents="none"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout
        setSize({ width: w, height: h })
      }}
    >
      {/* Nothing to draw until it has been measured: a zero-sized mask is a full-screen black
          rectangle with no hole in it, which is a frame of the camera being hidden entirely. */}
      {side === 0 ? null : (
        <Svg width={width} height={height}>
          <Defs>
            <Mask id="scannerCutout">
              {/* White is kept, black is cut. */}
              <Rect x={0} y={0} width={width} height={height} fill="#fff" />
              <Rect
                x={(width - side) / 2}
                y={(height - side) / 2}
                width={side}
                height={side}
                rx={CORNER}
                ry={CORNER}
                fill="#000"
              />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="#000"
            opacity={DIM}
            mask="url(#scannerCutout)"
          />
        </Svg>
      )}
    </YStack>
  )
}
