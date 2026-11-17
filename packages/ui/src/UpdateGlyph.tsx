import type { ReactNode } from 'react'
import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import {
  ProgressRing,
  TRANSFER_RING_SIDE_PX,
  TRANSFER_RING_SWEEP_DEGREES,
  TRANSFER_RING_THICKNESS,
} from './ProgressRing'
import { SIZE_SCALE } from './scales'
import type { UpdateStatus } from './UpdateIndicator.types'
import { morphFrame } from './updateIndicatorTiming'
import type { ActiveMorph } from './useUpdateMorph'
import { useTokenColor } from './useTokenColor'

const SIDE_PX = TRANSFER_RING_SIDE_PX
const GLYPH_PX = SIZE_SCALE.sm
/** How many dots the available ring is drawn with. */
const DOTS = 12

/** Where a ring of `sweep` degrees starts, so that its gap is centred on the bottom. */
const startFor = (sweep: number) => (360 - sweep) / 2 + 90

/** The smallest radius a ring is drawn at. */
const MIN_RADIUS = 0.01

/** The ring's radius, and so its circumference, at the transfer ring's stroke. */
const RADIUS = (SIDE_PX - TRANSFER_RING_THICKNESS) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * One ring round the glyph, in the transfer ring's size and stroke so that the states line up as
 * one control changing.
 *
 * `dots` draws it as `DOTS` dots, each `dash` long (a dash of almost nothing with round caps is a
 * dot the stroke's width across); otherwise it is solid, `sweep` degrees round with its gap at the
 * bottom as the download's ring has, and as thick as `thickness`, kept to the same outer edge.
 */
function Ring({
  color,
  opacity = 1,
  dots,
  dash = 0.01,
  sweep = 360,
  thickness = TRANSFER_RING_THICKNESS,
}: {
  color: string
  opacity?: number
  dots?: boolean
  dash?: number
  sweep?: number
  thickness?: number
}) {
  const stroke = useTokenColor(color)
  // Never quite 0: a circle of no radius draws nothing, however wide its stroke, and a stroke as
  // wide as the frame round almost none is the filled disc.
  const radius = Math.max(MIN_RADIUS, SIDE_PX / 2 - thickness / 2)
  const circumference = 2 * Math.PI * radius
  const gap = CIRCUMFERENCE / DOTS
  const centre = SIDE_PX / 2
  return (
    <Svg
      width={SIDE_PX}
      height={SIDE_PX}
      viewBox={`0 0 ${String(SIDE_PX)} ${String(SIDE_PX)}`}
      style={{ position: 'absolute' }}
    >
      <Circle
        cx={centre}
        cy={centre}
        r={radius}
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth={thickness}
        fill="none"
        strokeLinecap="round"
        {...(dots === true
          ? { strokeDasharray: `${String(dash)} ${String(Math.max(0.01, gap - dash))}` }
          : sweep < 360
            ? {
                strokeDasharray: `${String((circumference * sweep) / 360)} ${String(circumference)}`,
                transform: `rotate(${String(startFor(sweep))} ${String(centre)} ${String(centre)})`,
              }
            : {})}
      />
    </Svg>
  )
}

/** The square every state is drawn in, holding the ring placed over it. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <YStack
      width={SIDE_PX}
      height={SIDE_PX}
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      {children}
    </YStack>
  )
}

/** A glyph centred in the frame at `scale` of its size, which is how a morph shrinks and pops. */
function Glyph({
  name,
  color,
  scale = 1,
  sizePx = GLYPH_PX,
}: {
  name: IconName
  color: string
  scale?: number
  sizePx?: number
}) {
  if (scale <= 0) return null
  return (
    <YStack position="absolute" scale={scale}>
      <Icon name={name} size={sizePx} color={color} />
    </YStack>
  )
}

/** The download's ring is open at the bottom; these morphs close and open that gap. */
const DOWNLOAD_SWEEP = TRANSFER_RING_SWEEP_DEGREES

/** How much of the join the dots take to meet, before the gap opens. */
const JOIN_SHARE = 0.7
/** How much of the fill the gap takes to close, before the ring thickens. */
const CLOSE_SHARE = 0.25

/**
 * A morph's frame: the ring turning from one state's into the next, while the old glyph shrinks to
 * nothing and the new one pops in once the ring is done.
 *
 * `join`: the available ring's dots lengthen until they meet, its grey becoming the track's, and
 * the gap the download's ring keeps at the bottom opens. `fill`: the finished download's ring
 * closes its gap and thickens inward until it is the ready disc.
 */
function MorphGlyph({ morph, elapsedMs }: ActiveMorph) {
  const { ring, outgoing, incoming } = morphFrame(elapsedMs)
  if (morph === 'join') {
    // The dots meet over the first part, then the gap opens.
    const joined = Math.min(1, ring / JOIN_SHARE)
    const opening = Math.max(0, (ring - JOIN_SHARE) / (1 - JOIN_SHARE))
    const gap = CIRCUMFERENCE / DOTS
    return (
      <Frame>
        {opening === 0 ? (
          <>
            <Ring color="$textSecondary" opacity={1 - joined} dots dash={gap * joined} />
            <Ring color="$bordersColor" opacity={joined} dots dash={gap * joined} />
          </>
        ) : (
          <Ring color="$bordersColor" sweep={360 - (360 - DOWNLOAD_SWEEP) * opening} />
        )}
        <Glyph name="cloudDownload" color="$textPrimary" scale={outgoing} />
        <Glyph name="download" color="$textPrimary" scale={incoming} />
      </Frame>
    )
  }
  // The gap closes over the first part, then the ring thickens to a disc.
  const closing = Math.min(1, ring / CLOSE_SHARE)
  const thickening = Math.max(0, (ring - CLOSE_SHARE) / (1 - CLOSE_SHARE))
  return (
    <Frame>
      <Ring
        color="$primaryColor"
        sweep={DOWNLOAD_SWEEP + (360 - DOWNLOAD_SWEEP) * closing}
        thickness={TRANSFER_RING_THICKNESS + (SIDE_PX - TRANSFER_RING_THICKNESS) * thickening}
      />
      <Glyph
        name="download"
        color={thickening > 0.5 ? '$onAccent' : '$textPrimary'}
        scale={outgoing}
      />
      <Glyph name="packageCheck" color="$onAccent" scale={incoming} />
    </Frame>
  )
}

/**
 * One update state, drawn still, or a morph between two. `UpdateIndicator` cross-fades between the
 * still ones.
 *
 * Told apart by glyph and ring rather than by colour, so that they read in a light theme as well as
 * a dark one: the glyph is the text colour on a ring, the progress takes the accent, and ready is
 * the one filled disc. An error is a ring in the danger colour, since it is the one that asks for
 * something to be done.
 */
export function UpdateGlyph({
  status,
  morph,
}: {
  status: UpdateStatus
  morph?: ActiveMorph | null | undefined
}) {
  if (morph !== null && morph !== undefined) return <MorphGlyph {...morph} />
  switch (status.kind) {
    case 'available':
      return (
        <Frame>
          <Ring color="$textSecondary" dots />
          <Glyph name="cloudDownload" color="$textPrimary" />
        </Frame>
      )
    case 'downloading':
      return (
        <Frame>
          <YStack position="absolute">
            <ProgressRing
              progress={status.progress}
              size={SIDE_PX}
              thickness={TRANSFER_RING_THICKNESS}
            />
          </YStack>
          <Glyph name="download" color="$textPrimary" />
        </Frame>
      )
    case 'ready':
      return (
        <Frame>
          <Ring color="$primaryColor" thickness={SIDE_PX} />
          <Glyph name="packageCheck" color="$onAccent" />
        </Frame>
      )
    case 'error':
      return (
        <Frame>
          <Ring color="$dangerColor" />
          <Glyph name="triangleAlert" color="$dangerColor" />
        </Frame>
      )
  }
}
