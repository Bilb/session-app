import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

import { Avatar } from '../Avatar'
import { Button, type ButtonProps } from '../Button'
import { FileRow, type FileRowProps } from '../FileRow'
import { ProgressRing } from '../ProgressRing'
import { RadioIndicator } from '../RadioIndicator'
import { SIZE_SCALE } from '../scales'
import { SettingsRow, type SettingsRowProps } from '../SettingsRow'
import { Text } from '../Text'
import { defineStory, type AnyStory } from './story'

const noop = () => {}

const LONG = 'A label long enough to need a second line or an ellipsis at this width'

const PDF = { contentType: 'application/pdf', filename: 'report.pdf' } as const

/** A sent bubble's fill, which is what `onAccent` is drawn on. */
function AccentFill({ children }: { children: ReactNode }) {
  return (
    <YStack backgroundColor="$primaryColor" borderRadius="$lg" padding="$xs">
      {children}
    </YStack>
  )
}

const button = defineStory<ButtonProps>({
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
    danger: { variant: 'danger', children: 'Delete', onPress: noop },
    disabled: { variant: 'solid', children: 'Continue', disabled: true, onPress: noop },
    loading: { variant: 'solid', children: 'Continue', loading: true, onPress: noop },
    long: { variant: 'solid', children: LONG, onPress: noop },
  },
  render: (props) => <Button {...props} />,
})

const buttonSizes = defineStory<ButtonProps>({
  component: 'button',
  story: 'sizes',
  width: 220,
  variants: {
    xs: { size: 'xs', children: 'Continue', onPress: noop },
    sm: { size: 'sm', children: 'Continue', onPress: noop },
    md: { size: 'md', children: 'Continue', onPress: noop },
    lg: { size: 'lg', children: 'Continue', onPress: noop },
  },
  render: (props) => <Button {...props} />,
})

const ROW = { onPress: noop } as const

const settingsRow = defineStory<SettingsRowProps>({
  component: 'settingsRow',
  story: 'variants',
  width: 390,
  forced: ['hover', 'press', 'focus'],
  sensitive: { rtl: true, responsive: true, accent: true },
  variants: {
    plain: {
      ...ROW,
      testID: 'catalog-settings-row-plain',
      label: 'Notifications',
      icon: 'bellOff',
    },
    subtitle: {
      ...ROW,
      testID: 'catalog-settings-row-subtitle',
      label: 'Privacy',
      subtitle: 'Read receipts, typing indicators',
      icon: 'lockKeyhole',
    },
    accentIcon: {
      ...ROW,
      testID: 'catalog-settings-row-accentIcon',
      label: 'Session Pro',
      icon: 'settings',
      accentIcon: true,
    },
    destructive: {
      ...ROW,
      testID: 'catalog-settings-row-destructive',
      label: 'Clear data',
      icon: 'trash',
      destructive: true,
    },
    disabled: {
      ...ROW,
      testID: 'catalog-settings-row-disabled',
      label: 'Notifications',
      icon: 'bellOff',
      disabled: true,
    },
    long: {
      ...ROW,
      testID: 'catalog-settings-row-long',
      label: LONG,
      subtitle: LONG,
      icon: 'clock',
    },
  },
  render: (props) => <SettingsRow {...props} />,
})

const fileRow = defineStory<FileRowProps>({
  component: 'fileRow',
  story: 'states',
  width: 360,
  forced: ['focus'],
  sensitive: { rtl: true, responsive: true },
  variants: {
    idle: { ...PDF, caption: '180 kB', state: 'idle', actionLabel: 'Download', onAction: noop },
    fetching: {
      ...PDF,
      caption: '90 of 180 kB',
      state: 'fetching',
      progress: 0.5,
      actionLabel: 'Downloading',
      onAction: noop,
    },
    ready: { ...PDF, caption: '180 kB', state: 'ready', actionLabel: 'Export', onAction: noop },
    failed: {
      ...PDF,
      caption: 'Failed to download',
      state: 'failed',
      actionLabel: 'Retry',
      onAction: noop,
    },
    unavailable: { ...PDF, caption: 'Attachment expired', state: 'unavailable' },
    longName: {
      ...PDF,
      filename: 'quarterly-board-meeting-minutes-final-revised-v7.pdf',
      caption: '18.4 MB',
      state: 'idle',
      actionLabel: 'Download',
      onAction: noop,
    },
    arabicName: {
      ...PDF,
      filename: 'تقرير-الربع-الثالث.pdf',
      caption: '2 MB',
      state: 'idle',
      actionLabel: 'Download',
      onAction: noop,
    },
  },
  render: (props) => <FileRow {...props} />,
})

const fileRowOnAccent = defineStory<FileRowProps>({
  component: 'fileRow',
  story: 'onAccent',
  width: 360,
  sensitive: { accent: true },
  variants: {
    idle: {
      ...PDF,
      caption: '180 kB',
      state: 'idle',
      actionLabel: 'Download',
      onAction: noop,
      onAccent: true,
    },
    failed: {
      ...PDF,
      caption: 'Failed to download',
      state: 'failed',
      actionLabel: 'Retry',
      onAction: noop,
      onAccent: true,
    },
  },
  render: (props) => (
    <AccentFill>
      <FileRow {...props} />
    </AccentFill>
  ),
})

const radio = defineStory<{ selected: boolean; disabled?: boolean }>({
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

const avatar = defineStory<{ name: string; size: 'xl' | '2xl' | '3xl' }>({
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

const progressRing = defineStory<{ progress: number }>({
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

const textScale = defineStory<{ size: '$caption' | '$label' | '$body' | '$title' | '$heading' }>({
  component: 'text',
  story: 'scale',
  width: 320,
  sensitive: { rtl: true },
  variants: {
    caption: { size: '$caption' },
    label: { size: '$label' },
    body: { size: '$body' },
    title: { size: '$title' },
    heading: { size: '$heading' },
  },
  render: ({ size }) => <Text size={size}>The quick brown fox jumps over the lazy dog</Text>,
})

export const STORIES: readonly AnyStory[] = [
  button,
  buttonSizes,
  settingsRow,
  fileRow,
  fileRowOnAccent,
  radio,
  avatar,
  progressRing,
  textScale,
]
