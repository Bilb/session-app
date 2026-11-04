import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

import { RingSpin } from './RingSpin'
import { useTokenColor } from './useTokenColor'

/**
 * How much of the circle the ring occupies, in degrees.
 *
 * iOS trims its circle to `0.85` (306°) and Android sweeps `310f`; four degrees apart and
 * indistinguishable. The gap is the point: a ring with a piece missing reads as a gauge, where a
 * closed one reads as a spinner that has stopped.
 */
export const TRANSFER_RING_SWEEP_DEGREES = 306

/**
 * Where the arc begins, derived rather than written down.
 *
 * Android computes `(360 - sweep)/2 + 90`, which centres the gap on six o'clock whatever the sweep
 * is; iOS hardcodes 117, which is the same number for its own sweep and would stop being right if
 * the sweep changed. Taking the derivation means the gap stays at the bottom either way.
 *
 * For a 306° sweep this is 117° — just left of bottom-centre. The fill then climbs the **left**
 * side, crosses the top and comes down the right, which is the direction the arc is described by.
 */
const START_DEGREES = (360 - TRANSFER_RING_SWEEP_DEGREES) / 2 + 90

/**
 * A transfer's ring: an attachment's download and upload, and the app's own update. Drawn inside
 * the touch target rather than filling it, so it reads as a gauge and not a button.
 */
export const TRANSFER_RING_SIDE_PX = 28
export const TRANSFER_RING_THICKNESS = 3

/**
 * How much of the sweep an indeterminate ring's arc covers: long enough to read as an arc rather
 * than a dot at the smallest ring, short enough that it never reads as a reading.
 */
const INDETERMINATE_SHARE = 0.22

/** Twelve o'clock, in SVG's degrees, which start at three and run clockwise. */
const TOP_DEGREES = 270

type RingShared = {
  size: number
  /**
   * Ring thickness. Kept proportional by the caller rather than derived, so a small ring stays
   * legible.
   */
  thickness?: number | undefined
  /** The fill's token; the accent unless the ring sits on an accent fill. */
  color?: string | undefined
  /**
   * The track's token. The border role by default, which reads on the page; a ring on a nested
   * surface takes `$progressTrack`, since the border is barely a step from that surface.
   */
  trackColor?: string | undefined
}

type DeterminateRing = {
  /** How far round, 0 to 1. Clamped, because a ring that has gone past its end reads as a bug. */
  progress: number
}

/**
 * Nothing yet says how far along it is: the first report of a transfer is 0 of 0, which means
 * beginning, not empty. A short arc turns round the track instead of a fill climbing it.
 */
type IndeterminateRing = {
  indeterminate: true
  /** The arc held at the top rather than turning. See `RingSpinProps.still`. */
  still?: boolean | undefined
}

type ProgressRingProps = RingShared & (DeterminateRing | IndeterminateRing)

/** One stroked circle, its dash `length` long from `startDegrees`, clockwise. */
function Arc({
  size,
  thickness,
  stroke,
  length,
  startDegrees,
}: {
  size: number
  thickness: number
  stroke: string
  length: number
  startDegrees: number
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <Circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke={stroke}
      strokeWidth={thickness}
      fill="none"
      strokeLinecap="round"
      // `length` then a gap of everything else: one dash, so the stroke stops where it should.
      strokeDasharray={`${String(length)} ${String(circumference)}`}
      transform={`rotate(${String(startDegrees)} ${String(size / 2)} ${String(size / 2)})`}
    />
  )
}

/**
 * A ring, open at the bottom: determinate, or a turning arc while nothing says how far along.
 *
 * A ring rather than a bar because that is what both mobile clients draw for this -- iOS's
 * `CircularProgressView` and Android's `ProgressArc` -- and they agree on the copy beside it too.
 *
 * Drawn with a dash pattern rather than an arc path: one circle and two lengths, with no
 * trigonometry to get wrong at the wrap-around. The dash begins at three o'clock and runs clockwise
 * in SVG, which is the same convention SwiftUI and Compose use, so the angles above are the
 * clients' own numbers rather than a translation of them.
 *
 * The track never turns, so the gap stays at the bottom; an indeterminate arc turns over it on a
 * layer of its own, and passes over the gap as it goes.
 */
export function ProgressRing(props: ProgressRingProps) {
  const { size, thickness = 4, color = '$primaryColor', trackColor = '$bordersColor' } = props
  const track = useTokenColor(trackColor)
  const fill = useTokenColor(color)
  const radius = (size - thickness) / 2
  /** The drawn part of the circle. Everything below measures against this, not the whole. */
  const arc = 2 * Math.PI * radius * (TRANSFER_RING_SWEEP_DEGREES / 360)
  const viewBox = `0 0 ${String(size)} ${String(size)}`
  const ring = { size, thickness }

  // The track, drawn at the full sweep so the gap is visible before anything fills. Both clients
  // draw one, in a quieter colour rather than a dimmed accent, so it reads as the shape the ring
  // will fill rather than as a second, paler ring.
  const trackArc = <Arc {...ring} stroke={track} length={arc} startDegrees={START_DEGREES} />

  if ('progress' in props) {
    const fraction = Math.min(1, Math.max(0, props.progress))
    return (
      <Svg width={size} height={size} viewBox={viewBox}>
        {trackArc}
        {/* A fraction of the arc rather than of the circle: at 100% the fill reaches the end of
            the track and stops, instead of carrying on round into the gap. */}
        <Arc {...ring} stroke={fill} length={arc * fraction} startDegrees={START_DEGREES} />
      </Svg>
    )
  }

  const spanDegrees = TRANSFER_RING_SWEEP_DEGREES * INDETERMINATE_SHARE
  return (
    <YStack width={size} height={size} position="relative">
      <Svg width={size} height={size} viewBox={viewBox}>
        {trackArc}
      </Svg>
      <YStack fullscreen>
        <RingSpin size={size} still={props.still === true}>
          <Svg width={size} height={size} viewBox={viewBox}>
            {/* Starts centred on the top, so a ring held still -- reduced motion, a capture --
                shows an arc no determinate reading would draw, rather than one that reads 22%. */}
            <Arc
              {...ring}
              stroke={fill}
              length={arc * INDETERMINATE_SHARE}
              startDegrees={TOP_DEGREES - spanDegrees / 2}
            />
          </Svg>
        </RingSpin>
      </YStack>
    </YStack>
  )
}
