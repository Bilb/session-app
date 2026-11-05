import { Button, type ButtonProps } from '../../Button'
import { defineStory } from '../story'
import { MessageFrame } from '../../MessageFrame'
import { LONG, noop } from './shared'

export const button = defineStory<ButtonProps>({
  component: 'button',
  story: 'variants',
  width: 220,
  forced: ['hover', 'press', 'focus'],
  sensitive: { accent: true },
  variants: {
    solid: { variant: 'solid', children: 'Continue', onPress: noop },
    outline: { variant: 'outline', children: 'Continue', onPress: noop },
    outlineAccent: { variant: 'outlineAccent', children: 'Continue', onPress: noop },
    tonal: { variant: 'tonal', children: 'Continue', onPress: noop },
    ghost: { variant: 'ghost', children: 'Continue', onPress: noop },
    ghostAccent: { variant: 'ghostAccent', children: 'Continue', onPress: noop },
    simple: { variant: 'simple', children: 'Continue', onPress: noop },
    subtle: { variant: 'subtle', children: 'Export Logs', onPress: noop },
    danger: { variant: 'danger', children: 'Delete', onPress: noop },
    disabled: { variant: 'solid', children: 'Continue', disabled: true, onPress: noop },
    loading: { variant: 'solid', children: 'Continue', loading: true, onPress: noop },
    // A frameless button loading, which draws no outline, with the spinner at its smaller scale.
    subtleLoading: {
      variant: 'subtle',
      size: 'sm',
      children: 'Export Logs',
      loading: true,
      onPress: noop,
    },
    long: { variant: 'solid', children: LONG, onPress: noop },
  },
  render: (props) => <Button {...props} />,
})

/** On a bubble you sent: the ring takes the on-accent ink, and a button keeps its own fill. */
export const buttonOnAccent = defineStory<ButtonProps>({
  component: 'button',
  story: 'onAccent',
  width: 220,
  forced: ['press', 'focus'],
  sensitive: { accent: true },
  variants: {
    tonal: { variant: 'tonal', children: 'Continue', onPress: noop, onAccent: true },
    cell: {
      variant: 'simple',
      borderRadius: '$none',
      children: 'Continue',
      onPress: noop,
      onAccent: true,
    },
  },
  render: (props) => (
    <MessageFrame outgoing>
      <Button {...props} />
    </MessageFrame>
  ),
})

export const buttonSizes = defineStory<ButtonProps>({
  component: 'button',
  story: 'sizes',
  width: 220,
  variants: {
    xs: { size: 'xs', children: 'Continue', onPress: noop },
    sm: { size: 'sm', children: 'Continue', onPress: noop },
    md: { size: 'md', children: 'Continue', onPress: noop },
    lg: { size: 'lg', children: 'Continue', onPress: noop },
    // The spinner follows the label's size: smaller under the two smaller sizes.
    smLoading: { size: 'sm', children: 'Continue', loading: true, onPress: noop },
    mdLoading: { size: 'md', children: 'Continue', loading: true, onPress: noop },
  },
  render: (props) => <Button {...props} />,
})
