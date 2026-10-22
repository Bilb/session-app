import { FileRow, type FileRowProps } from '../../FileRow'
import { defineStory } from '../story'
import { AccentFill, noop } from './shared'

const PDF = { contentType: 'application/pdf', filename: 'report.pdf' } as const

const OPENS = { onOpen: noop, openLabel: 'Open' } as const

export const fileRow = defineStory<FileRowProps>({
  component: 'fileRow',
  story: 'states',
  width: 360,
  forced: ['focus'],
  sensitive: { rtl: true, responsive: true },
  variants: {
    idle: {
      ...PDF,
      ...OPENS,
      caption: '180 kB',
      state: 'idle',
      actionLabel: 'Download',
      onAction: noop,
    },
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

export const fileRowOnAccent = defineStory<FileRowProps>({
  component: 'fileRow',
  story: 'onAccent',
  width: 360,
  forced: ['focus'],
  sensitive: { accent: true },
  variants: {
    idle: {
      ...PDF,
      ...OPENS,
      caption: '180 kB',
      state: 'idle',
      actionLabel: 'Download',
      onAction: noop,
      onAccent: true,
    },
    fetching: {
      ...PDF,
      caption: '90 of 180 kB',
      state: 'fetching',
      progress: 0.5,
      actionLabel: 'Downloading',
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
