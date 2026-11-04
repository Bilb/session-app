import { useEffect, useState } from 'react'
import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

import { RingSpin } from './RingSpin'
import { easeOut, MORPH_RING_MS } from './updateIndicatorTiming'
import { useReducedMotion } from './useReducedMotion'
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
const startFor = (sweep: number) => (360 - sweep) / 2 + 90
const START_DEGREES = startFor(TRANSFER_RING_SWEEP_DEGREES)

/**
 * A transfer's ring: an attachment's download and upload, and the app's own update. Drawn inside
 * the touch target rather than filling it, so it reads as a gauge and not a button.
 */
export const TRANSFER_RING_SIDE_PX = 28
export const TRANSFER_RING_THICKNESS = 3

/**
 * How much of the open sweep an indeterminate ring's arc covers: long enough to read as an arc
 * rather than a dot at the smallest ring, short enough that it never reads as a reading.
 */
const INDETERMINATE_SHARE = 0.22

/** Twelve o'clock, in SVG's degrees, which start at three and run clockwise. */
const TOP_DEGREES = 270

/** A closed track: the waiting ring's, which has no end for a fill to start from. */
const FULL_SWEEP_DEGREES = 360

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
  /**
   * No motion: the waiting arc held at the top, and the gap opened at once when a reading
   * arrives. See the `disableAnimations` flag; a system asking for reduced motion does the same.
   */
  still?: boolean | undefined
}

type DeterminateRing = {
  /** How far round, 0 to 1. Clamped, because a ring that has gone past its end reads as a bug. */
  progress: number
}

/**
 * Nothing yet says how far along it is: the first report of a transfer is 0 of 0, which means
 * beginning, not empty. The track is closed and a short arc turns round it.
 */
type IndeterminateRing = {
  indeterminate: true
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
      // `length` then a gap of everything else: one dash, so the stroke stops where it should. A
      // dash the whole way round is a closed circle with nothing to cap.
      {...(length >= circumference
        ? {}
        : { strokeDasharray: `${String(length)} ${String(circumference)}` })}
      transform={`rotate(${String(startDegrees)} ${String(size / 2)} ${String(size / 2)})`}
    />
  )
}

export type ProgressRingFrameProps = {
  size: number
  thickness: number
  /** The fill's token. */
  color: string
  /** The track's token. */
  trackColor: string
  /** How far round the track runs: 360 closed, down to the open sweep. */
  trackSweepDegrees: number
  /**
   * What is drawn on the track: a reading from 0 to 1, a turning arc while there is none, or
   * nothing while the gap is opening.
   */
  reading: number | 'waiting' | null
  /** The waiting arc held at the top. */
  still: boolean
}

/**
 * One frame of the ring, from what it is showing: no state and no timing, so a story can draw any
 * frame of the opening, and `ProgressRing` only has to say which frame it is at.
 *
 * The track never turns, so a gap stays at the bottom; the waiting arc turns over it on a layer
 * of its own, all the way round the closed track.
 */
export function ProgressRingFrame({
  size,
  thickness,
  color,
  trackColor,
  trackSweepDegrees,
  reading,
  still,
}: ProgressRingFrameProps) {
  const track = useTokenColor(trackColor)
  const fill = useTokenColor(color)
  const circumference = 2 * Math.PI * ((size - thickness) / 2)
  /** The open track. A reading and the waiting arc both measure against this, not the whole. */
  const arc = circumference * (TRANSFER_RING_SWEEP_DEGREES / 360)
  const viewBox = `0 0 ${String(size)} ${String(size)}`
  const ring = { size, thickness }
  const spanDegrees = TRANSFER_RING_SWEEP_DEGREES * INDETERMINATE_SHARE

  return (
    <YStack width={size} height={size} position="relative">
      <Svg width={size} height={size} viewBox={viewBox}>
        {/* Drawn before anything fills, so the shape is there first. Both clients draw one, in a
            quieter colour rather than a dimmed accent, so it reads as the shape the ring will
            fill rather than as a second, paler ring. */}
        <Arc
          {...ring}
          stroke={track}
          length={(circumference * trackSweepDegrees) / 360}
          startDegrees={startFor(trackSweepDegrees)}
        />
        {typeof reading !== 'number' ? null : (
          // A fraction of the arc rather than of the circle: at 100% the fill reaches the end of
          // the track and stops, instead of carrying on round into the gap.
          <Arc
            {...ring}
            stroke={fill}
            length={arc * Math.min(1, Math.max(0, reading))}
            startDegrees={START_DEGREES}
          />
        )}
      </Svg>
      {reading !== 'waiting' ? null : (
        <YStack fullscreen>
          <RingSpin size={size} still={still}>
            <Svg width={size} height={size} viewBox={viewBox}>
              {/* Starts centred on the top, so a ring held still -- reduced motion, a capture --
                  shows an arc no reading would draw, rather than one that reads 22%. */}
              <Arc
                {...ring}
                stroke={fill}
                length={arc * INDETERMINATE_SHARE}
                startDegrees={TOP_DEGREES - spanDegrees / 2}
              />
            </Svg>
          </RingSpin>
        </YStack>
      )}
    </YStack>
  )
}

/**
 * How far the gap has opened since the ring stopped waiting, eased from 0 to 1, or null when it is
 * not opening. The track's sweep changes, which no transform can express, so this is driven by
 * animation frames as the update glyph's morphs are, and serves both platforms.
 *
 * The change is noticed during render, so the frame that first draws a reading already draws the
 * closed track rather than an open one the opening then replaces.
 */
function useGapOpening(waiting: boolean, instant: boolean): number | null {
  const [run, setRun] = useState({ waiting, opening: false, id: 0 })
  if (run.waiting !== waiting)
    setRun({ waiting, opening: run.waiting && !waiting && !instant, id: run.id + 1 })

  const [elapsed, setElapsed] = useState({ id: 0, ms: 0 })
  useEffect(() => {
    if (!run.opening) return
    const started = Date.now()
    let frame = 0
    const tick = () => {
      const ms = Date.now() - started
      setElapsed({ id: run.id, ms })
      if (ms < MORPH_RING_MS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [run])

  if (!run.opening || instant) return null
  const ms = elapsed.id === run.id ? elapsed.ms : 0
  return ms >= MORPH_RING_MS ? null : easeOut(ms / MORPH_RING_MS)
}

/**
 * A ring: open at the bottom with a reading on it, or closed with an arc turning round it while
 * nothing says how far along.
 *
 * A ring rather than a bar because that is what both mobile clients draw for this -- iOS's
 * `CircularProgressView` and Android's `ProgressArc` -- and they agree on the copy beside it too.
 *
 * Drawn with a dash pattern rather than an arc path: one circle and two lengths, with no
 * trigonometry to get wrong at the wrap-around. The dash begins at three o'clock and runs clockwise
 * in SVG, which is the same convention SwiftUI and Compose use, so the angles above are the
 * clients' own numbers rather than a translation of them.
 *
 * When a reading arrives the closed track opens its gap at six o'clock, as the update glyph's ring
 * does when its download starts, and only then does the fill start climbing.
 */
export function ProgressRing(props: ProgressRingProps) {
  const { size, thickness = 4, color = '$primaryColor', trackColor = '$bordersColor' } = props
  const reduced = useReducedMotion()
  const still = props.still === true || reduced
  const waiting = !('progress' in props)
  const opening = useGapOpening(waiting, still)
  const frame = { size, thickness, color, trackColor, still }

  if (waiting)
    return <ProgressRingFrame {...frame} trackSweepDegrees={FULL_SWEEP_DEGREES} reading="waiting" />
  if (opening !== null)
    return (
      <ProgressRingFrame
        {...frame}
        trackSweepDegrees={
          FULL_SWEEP_DEGREES - (FULL_SWEEP_DEGREES - TRANSFER_RING_SWEEP_DEGREES) * opening
        }
        reading={null}
      />
    )
  return (
    <ProgressRingFrame
      {...frame}
      trackSweepDegrees={TRANSFER_RING_SWEEP_DEGREES}
      reading={props.progress}
    />
  )
}
