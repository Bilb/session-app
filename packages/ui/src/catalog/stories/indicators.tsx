import { Avatar } from '../../Avatar'
import { ButtonProgress } from '../../ButtonProgress'
import { MessageFrame } from '../../MessageFrame'
import { ProgressRing } from '../../ProgressRing'
import { RadioIndicator } from '../../RadioIndicator'
import { SIZE_SCALE } from '../../scales'
import { defineStory } from '../story'

export const radio = defineStory<{ selected: boolean; disabled?: boolean }>({
  component: 'radioIndicator',
  story: 'states',
  width: 40,
  variants: {
    off: { selected: false },
    on: { selected: true },
    offDisabled: { selected: false, disabled: true },
    onDisabled: { selected: true, disabled: true },
  },
  render: (props) => <RadioIndicator {...props} />,
})

export const avatar = defineStory<{ name: string; size: 'xl' | '2xl' | '3xl' }>({
  component: 'avatar',
  story: 'sizes',
  width: 72,
  variants: {
    xl: { name: 'Alice', size: 'xl' },
    '2xl': { name: 'Bob', size: '2xl' },
    '3xl': { name: 'Zoë', size: '3xl' },
    emoji: { name: '🦊 Fox', size: '2xl' },
    arabic: { name: 'ليلى', size: '2xl' },
  },
  render: ({ name, size }) => <Avatar id={`05${name}`} name={name} size={size} />,
})

interface RingRow {
  /** Absent for a ring that does not know how far along it is. */
  progress?: number | undefined
  trackColor?: string | undefined
}

export const progressRing = defineStory<RingRow>({
  component: 'progressRing',
  story: 'progress',
  width: 48,
  sensitive: { accent: true },
  variants: {
    empty: { progress: 0 },
    quarter: { progress: 0.25 },
    half: { progress: 0.5 },
    full: { progress: 1 },
    progressTrack: { progress: 0.4, trackColor: '$progressTrack' },
    // Held at the top in a capture: the catalog asks for reduced motion and cancels animations.
    indeterminate: {},
    indeterminateProgressTrack: { trackColor: '$progressTrack' },
  },
  render: ({ progress, trackColor }) =>
    progress === undefined ? (
      <ProgressRing indeterminate size={SIZE_SCALE.xl} trackColor={trackColor} />
    ) : (
      <ProgressRing progress={progress} size={SIZE_SCALE.xl} trackColor={trackColor} />
    ),
})

interface ButtonProgressRow {
  outgoing: boolean
  /** Absent for the first report of a transfer, 0 of 0, which says nothing yet. */
  progress?: number | undefined
}

/** In the footer's frame, on both bubbles: the frame keeps its own fill on the accent. */
export const buttonProgress = defineStory<ButtonProgressRow>({
  component: 'buttonProgress',
  story: 'bubbles',
  width: 96,
  sensitive: { accent: true },
  variants: {
    startingReceived: { outgoing: false },
    fortyReceived: { outgoing: false, progress: 0.4 },
    ninetyFiveReceived: { outgoing: false, progress: 0.95 },
    startingSent: { outgoing: true },
    fortySent: { outgoing: true, progress: 0.4 },
    ninetyFiveSent: { outgoing: true, progress: 0.95 },
  },
  render: ({ outgoing, progress }) => (
    <MessageFrame outgoing={outgoing}>
      {progress === undefined ? (
        <ButtonProgress size="sm" label="Downloading..." indeterminate />
      ) : (
        <ButtonProgress
          size="sm"
          label="Downloading..."
          progress={progress}
          valueText={`${String(Math.round(progress * 30))} MB of 30 MB`}
        />
      )}
    </MessageFrame>
  ),
})
