import { Avatar } from '../../Avatar'
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

export const progressRing = defineStory<{ progress: number }>({
  component: 'progressRing',
  story: 'progress',
  width: 48,
  sensitive: { accent: true },
  variants: {
    empty: { progress: 0 },
    quarter: { progress: 0.25 },
    half: { progress: 0.5 },
    full: { progress: 1 },
  },
  render: ({ progress }) => <ProgressRing progress={progress} size={SIZE_SCALE.xl} />,
})
