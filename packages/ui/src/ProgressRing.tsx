import Svg, { Circle } from 'react-native-svg'

interface ProgressRingProps {
  /** How far round, 0 to 1. Clamped, because a ring that has gone past its end reads as a bug. */
  progress: number
  size: number
  /** Ring thickness. Kept proportional by the caller rather than derived, so a small ring stays legible. */
  thickness?: number
}

/**
 * A determinate ring.
 *
 * A ring rather than a bar because that is what both mobile clients draw for this -- iOS's
 * `CircularProgressView` and Android's `ProgressArc` -- and they agree on the copy beside it too.
 *
 * Drawn with a dash offset rather than an arc path: one circle, two numbers, and no trigonometry to
 * get wrong at the wrap-around. Rotated so it starts at twelve o'clock, which is the only place a
 * progress ring can start without looking like it began mid-turn.
 */
export function ProgressRing({ progress, size, thickness = 4 }: ProgressRingProps) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = Math.min(1, Math.max(0, progress))

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${String(size)} ${String(size)}`}>
      {/* The track. Drawn from the border colour rather than a dimmed accent, so it reads as the
          shape the ring will fill rather than as a second, paler ring. */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--bordersColor)"
        strokeWidth={thickness}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--primaryColor)"
        strokeWidth={thickness}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        // Twelve o'clock, rotating about the centre.
        transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
      />
    </Svg>
  )
}
